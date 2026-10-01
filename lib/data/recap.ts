import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { buildRecap, weekOf, RecapBody, RecapWindow } from "@/lib/recap";
import type {
  Approach,
  Battle,
  ProblemEvent,
  Suggestion,
  SquadMember,
  SquadRecap,
} from "@/types/database";

/**
 * Recap reads and generation (Step 20).
 *
 * Generation reads the real rows for the window and freezes the projection into
 * `squad_recaps.body_json`. Regenerating a week replaces it — one recap per
 * squad per week, enforced by a unique index.
 */

async function loadMembers(squadId: string): Promise<SquadMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId);
  if (error) {
    throw new DataError("recap", "Couldn't load squad members. Retry.", { cause: error });
  }
  return ((data ?? []) as { user_id: string }[]) as SquadMember[];
}

export async function generateRecap(squadId: string, squadName: string): Promise<RecapBody> {
  const supabase = createClient();
  const window = weekOf(new Date());
  const members = await loadMembers(squadId);
  const memberIds = members.map((m) => m.user_id);

  if (memberIds.length === 0) {
    throw new DataError("recap", "A squad needs members before it can have a week.");
  }

  const from = `${window.weekStart}T00:00:00.000Z`;
  const to = `${window.weekEnd}T23:59:59.999Z`;

  const [eventsRes, battlesRes, approachesRes, challengesRes, profilesRes, primersRes, notesRes, squadRes] =
    await Promise.all([
      supabase
        .from("problem_events")
        .select("id,user_id,problem_slug,kind,battle_id,duration_sec,metadata,created_at")
        .in("user_id", memberIds)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(5000),
      supabase
        .from("battles")
        .select("id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at")
        .in("user_id", memberIds)
        .gte("started_at", from)
        .lte("started_at", to)
        .limit(2000),
      supabase
        .from("approaches")
        .select("id,user_id,problem_slug,pattern,core_idea,visibility,created_at,updated_at")
        .in("user_id", memberIds)
        .gte("created_at", from)
        .limit(500),
      supabase
        .from("suggestions")
        .select("id,from_user,to_user,problem_slug,problem_title,difficulty,status,created_at,completed_at")
        .in("from_user", memberIds)
        .gte("created_at", from)
        .limit(500),
      supabase.from("profiles").select("id,username").in("id", memberIds),
      supabase.from("primers").select("id,title,slug"),
      supabase
        .from("notebook_notes")
        .select("fork_of, created_at")
        .not("fork_of", "is", null)
        .gte("created_at", from)
        .limit(500),
      supabase.from("squads").select("id,name").eq("id", squadId).maybeSingle(),
    ]);

  const problems = eventsRes.data ?? [];
  const battles = battlesRes.data ?? [];
  const approaches = approachesRes.data ?? [];
  const challenges = challengesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const primers = primersRes.data ?? [];
  const notes = notesRes.data ?? [];

  const usernames = new Map<string, string>(
    (profiles as { id: string; username: string }[]).map((p) => [p.id, p.username])
  );

  // Count primer copies by primer id. Approaches get their own treatment in
  // Step 16; this only credits primers, which is what the copy says.
  const primerCopies = new Map<string, number>();
  const primerIds = new Set((primers as { id: string }[]).map((p) => p.id));
  for (const n of notes as { fork_of: string | null }[]) {
    if (n.fork_of && primerIds.has(n.fork_of)) {
      primerCopies.set(n.fork_of, (primerCopies.get(n.fork_of) ?? 0) + 1);
    }
  }
  const primerTitles = new Map<string, string>(
    (primers as { id: string; title: string }[]).map((p) => [p.id, p.title])
  );

  const body = buildRecap({
    window,
    squadName: (squadRes.data as { name: string } | null)?.name ?? squadName,
    memberIds,
    usernames,
    events: problems as ProblemEvent[],
    battles: battles as Battle[],
    approaches: approaches as Approach[],
    challenges: challenges as Suggestion[],
    primerTitles,
    primerCopies,
  });

  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { error } = await supabase.from("squad_recaps").upsert(
    {
      squad_id: squadId,
      week_start: window.weekStart,
      week_end: window.weekEnd,
      body_json: body,
      generated_by: userId,
    },
    { onConflict: "squad_id,week_start" }
  );

  if (error) {
    throw new DataError("recap", "Couldn't save that recap. Try again.", { cause: error });
  }
  track("recap_generated", { squad_id: squadId, week_start: window.weekStart, solves: body.solves });
  return body;
}

export async function getRecaps(squadId: string, limit = 12): Promise<SquadRecap[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_recaps")
    .select("*")
    .eq("squad_id", squadId)
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) {
    throw new DataError("recap", "Couldn't load recaps. Retry.", { cause: error });
  }
  return (data ?? []) as SquadRecap[];
}

export async function getRecapByWeek(squadId: string, window: RecapWindow) {
  const supabase = createClient();
  const { data } = await supabase
    .from("squad_recaps")
    .select("*")
    .eq("squad_id", squadId)
    .eq("week_start", window.weekStart)
    .maybeSingle();
  return (data as SquadRecap | null) ?? null;
}

/** Current week window, for callers that want to label "this week". */
export function currentWeek(): RecapWindow {
  return weekOf(new Date());
}