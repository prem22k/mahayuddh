import { createClient } from "@/lib/supabase/client";
import { getServiceClient } from "@/lib/supabase/service";
import { findProfileByUsername } from "@/lib/profiles/username";
import { DataError } from "@/lib/data/errors";
import { buildJourney, JourneyBody, journeyWindow } from "@/lib/journey";
import type { Approach, Battle, ProblemEvent, StuckRequest, Suggestion } from "@/types/database";

/**
 * Personal Journey (Step 20, Bible §31).
 *
 * A projection over the caller's own rows. The client query is scoped to them
 * by RLS, so there is no question of whose journey this is.
 */
export async function getMyJourney(days = 30): Promise<JourneyBody> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new DataError("journey", "Log in to see your journey.");

  const w = journeyWindow(days);
  const from = `${w.from}T00:00:00.000Z`;
  const to = `${w.to}T23:59:59.999Z`;

  const [profileRes, eventsRes, battlesRes, approachesRes, challengesRes, stuckRes] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      supabase
        .from("problem_events")
        .select("id,user_id,problem_slug,kind,battle_id,duration_sec,metadata,created_at")
        .eq("user_id", user.id)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(5000),
      supabase
        .from("battles")
        .select("id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at")
        .eq("user_id", user.id)
        .gte("started_at", from)
        .lte("started_at", to)
        .limit(2000),
      supabase
        .from("approaches")
        .select("id,user_id,problem_slug,pattern,visibility,created_at,updated_at")
        .eq("user_id", user.id)
        .gte("created_at", from)
        .limit(500),
      supabase
        .from("suggestions")
        .select("id,from_user,to_user,problem_slug,problem_title,difficulty,status,created_at,completed_at")
        .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
        .gte("created_at", from)
        .limit(500),
      supabase
        .from("stuck_requests")
        .select("id,user_id,problem_slug,battle_id,level,visibility,squad_id,status,last_reminded_at,created_at")
        .eq("user_id", user.id)
        .gte("created_at", from)
        .limit(200),
    ]);

  const events = (eventsRes.data ?? []) as ProblemEvent[];
  const slugs = Array.from(new Set(events.map((e) => e.problem_slug))).slice(0, 500);

  // Topics for the patterns touched. A missing catalog row simply contributes
  // no pattern rather than a guessed one.
  const problemPattern = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: catalog } = await supabase
      .from("problems")
      .select("title_slug, topics")
      .in("title_slug", slugs);
    for (const p of (catalog ?? []) as { title_slug: string; topics: string[] }[]) {
      if (p.topics?.length) problemPattern.set(p.title_slug, p.topics[0]);
    }
  }

  // Direction is per-row, so the caller's own id is compared downstream rather
  // than baked into the query.
  void user.id;
  const challenges = (challengesRes.data ?? []) as Suggestion[];

  return buildJourney({
    days,
    userId: user.id,
    username:
      (profileRes.data as { username: string } | null)?.username ?? "you",
    events,
    battles: (battlesRes.data ?? []) as Battle[],
    approaches: (approachesRes.data ?? []) as Approach[],
    challenges,
    stuck: (stuckRes.data ?? []) as StuckRequest[],
    problemPattern,
  });
}

/**
 * Server-side read for the public journey page and its OG image.
 * Returns null when there is nothing worth showing — an empty journey card is
 * not worth sharing.
 */
export async function getPublicJourney(
  username: string,
  days = 30
): Promise<JourneyBody | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const profile = await findProfileByUsername(supabase, username);
  if (!profile) return null;

  const userId = profile.id;
  const w = journeyWindow(days);
  const from = `${w.from}T00:00:00.000Z`;
  const to = `${w.to}T23:59:59.999Z`;

  const [eventsRes, battlesRes, approachesRes, challengesRes, stuckRes] = await Promise.all([
    supabase
      .from("problem_events")
      .select("id,user_id,problem_slug,kind,battle_id,duration_sec,metadata,created_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(5000),
    supabase
      .from("battles")
      .select("id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at")
      .eq("user_id", userId)
      .gte("started_at", from)
      .lte("started_at", to)
      .limit(2000),
    supabase
      .from("approaches")
      .select("id,user_id,problem_slug,pattern,visibility,created_at,updated_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .limit(500),
    supabase
      .from("suggestions")
      .select("id,from_user,to_user,problem_slug,problem_title,difficulty,status,created_at,completed_at")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .gte("created_at", from)
      .limit(500),
    supabase
      .from("stuck_requests")
      .select("id,user_id,problem_slug,battle_id,level,visibility,squad_id,status,last_reminded_at,created_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .limit(200),
  ]);

  const events = (eventsRes.data ?? []) as ProblemEvent[];
  if (events.length === 0 && (battlesRes.data ?? []).length === 0) return null;

  const slugs = Array.from(new Set(events.map((e) => e.problem_slug))).slice(0, 500);
  const problemPattern = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: catalog } = await supabase
      .from("problems")
      .select("title_slug, topics")
      .in("title_slug", slugs);
    for (const p of (catalog ?? []) as { title_slug: string; topics: string[] }[]) {
      if (p.topics?.length) problemPattern.set(p.title_slug, p.topics[0]);
    }
  }

  return buildJourney({
    days,
    userId,
    username: profile.username as string,
    events,
    battles: (battlesRes.data ?? []) as Battle[],
    approaches: (approachesRes.data ?? []) as Approach[],
    challenges: (challengesRes.data ?? []) as Suggestion[],
    stuck: (stuckRes.data ?? []) as StuckRequest[],
    problemPattern,
  });
}