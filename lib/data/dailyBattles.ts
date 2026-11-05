import { createClient } from "@/lib/supabase/client";
import { DailyPick, ProblemHistory } from "@/lib/dailyBattle";
import { DataError } from "@/lib/data/errors";
import { squadStartOfTodayUtcISO, squadTodayKey } from "@/lib/squadDays";

/**
 * Per-user history for the Daily Battle signals (plan Step 6).
 *
 * Derived from problem_events (append-only history, §48) rather than
 * user_problem_status, so "how many times have I failed this" is answerable.
 * Aggregated client-side to avoid a per-battle server round trip; the page
 * already holds the user's own rows and RLS scopes them.
 */
export async function getProblemHistory(slugs?: string[]): Promise<Map<string, ProblemHistory>> {
  const out = new Map<string, ProblemHistory>();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return out;

  const wanted = new Set((slugs ?? []).map((s) => s.toLowerCase()));
  let query = supabase
    .from("problem_events")
    .select("problem_slug, kind, duration_sec, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (wanted.size > 0) {
    // Chunked .in() to stay under PostgREST's parameter limits.
    const list = Array.from(wanted).slice(0, 1000);
    query = query.in("problem_slug", list);
  }

  const { data, error } = await query;
  if (error) {
    throw new DataError("history", "Couldn't load your practice history. Retry.", { cause: error });
  }

  for (const row of (data ?? []) as {
    problem_slug: string;
    kind: string;
    duration_sec: number | null;
    created_at: string;
  }[]) {
    const slug = row.problem_slug.toLowerCase();
    const entry = out.get(slug) ?? { failures: 0, revisits: 0, lastTouchedAt: null, bestSec: null };
    if (row.kind === "failed") entry.failures += 1;
    if (row.kind === "revisited") entry.revisits += 1;
    // Rows arrive newest-first, so the first hit is the latest touch.
    if (entry.lastTouchedAt == null) {
      const ts = Date.parse(row.created_at);
      if (!Number.isNaN(ts)) entry.lastTouchedAt = ts;
    }
    // Personal best: fastest completed solve, not the fastest of any kind.
    if (row.kind === "solved" && row.duration_sec != null) {
      entry.bestSec = entry.bestSec == null ? row.duration_sec : Math.min(entry.bestSec, row.duration_sec);
    }
    out.set(slug, entry);
  }

  return out;
}

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Squad-level inputs for the shared Daily Battle.
 *
 * Counts the members who were already in the squad at today's IST midnight
 * (falling back to every current member when the squad formed today), then
 * counts, per slug, how many of those members solved it before midnight.
 */
export async function getSquadDailyInputs(
  squadId: string,
  slugs: string[]
): Promise<{ memberIds: string[]; memberCount: number; solvedBy: Map<string, number> }> {
  const supabase = createClient();
  const since = squadStartOfTodayUtcISO();

  const { data: memberData, error: memberError } = await supabase
    .from("squad_members")
    .select("user_id, joined_at, active")
    .eq("squad_id", squadId);
  if (memberError) {
    throw new DataError("daily-battle", "Couldn't load your squad for today's battle. Retry.", {
      cause: memberError,
    });
  }

  const current = (
    (memberData ?? []) as { user_id: string; joined_at: string | null; active: boolean | null }[]
  ).filter((m) => m.active !== false);
  const sinceMs = Date.parse(since);
  const joinedBeforeToday = current.filter((m) => {
    if (!m.joined_at) return false;
    const joinedMs = Date.parse(m.joined_at);
    return !Number.isNaN(joinedMs) && joinedMs < sinceMs;
  });
  // A squad formed today has fewer than two members who joined before
  // midnight; count all current members rather than treating it as empty.
  const counted = joinedBeforeToday.length >= 2 ? joinedBeforeToday : current;
  const memberIds = Array.from(new Set(counted.map((m) => m.user_id)));

  const uniqueSlugs = Array.from(
    new Set(slugs.map((s) => s.toLowerCase()).filter((s) => s.length > 0))
  );
  const solvedBy = new Map<string, number>();
  if (memberIds.length === 0 || uniqueSlugs.length === 0) {
    return { memberIds, memberCount: memberIds.length, solvedBy };
  }

  // PostgREST caps a response at 1000 rows. Page every chunk until a short
  // page so a long solve history is not silently truncated, and keep each
  // `in` list small enough that the URL stays short.
  const usersBySlug = new Map<string, Set<string>>();
  for (const slugChunk of chunk(uniqueSlugs, IN_CHUNK_SIZE)) {
    for (const userChunk of chunk(memberIds, IN_CHUNK_SIZE)) {
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("user_problem_status")
          .select("user_id, problem_slug")
          .in("user_id", userChunk)
          .eq("status", "solved")
          .in("problem_slug", slugChunk)
          .or(`solved_at.is.null,solved_at.lt.${since}`)
          .order("user_id", { ascending: true })
          .order("problem_slug", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          throw new DataError("daily-battle", "Couldn't load your squad's solves. Retry.", {
            cause: error,
          });
        }
        const page = (data ?? []) as { user_id: string; problem_slug: string }[];
        for (const row of page) {
          const slug = row.problem_slug.toLowerCase();
          const users = usersBySlug.get(slug) ?? new Set<string>();
          users.add(row.user_id);
          usersBySlug.set(slug, users);
        }
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }
  }

  for (const [slug, users] of usersBySlug) solvedBy.set(slug, users.size);
  return { memberIds, memberCount: memberIds.length, solvedBy };
}

function today(): string {
  return squadTodayKey();
}

/**
 * Persist today's pick so it survives a refresh even if the underlying list
 * changes (plan Step 6: "one row/day/user cache").
 *
 * Falls back to the freshly computed pick when the user is anonymous or the
 * insert fails — the cache is an optimisation, never a gate.
 */
const writtenPicks = new Set<string>();

export async function cacheDailyBattle(
  userId: string | null,
  pick: DailyPick
): Promise<void> {
  if (!userId) return;
  // One write per user, day and pick per tab. The home page calls this on
  // every visit; without the guard each revisit was a database write.
  const writeKey = `${userId}|${today()}|${pick.problem.title_slug.toLowerCase()}`;
  if (writtenPicks.has(writeKey)) return;
  writtenPicks.add(writeKey);
  const supabase = createClient();
  try {
    await supabase.from("daily_battles").upsert(
      {
        user_id: userId,
        battle_date: today(),
        problem_slug: pick.problem.title_slug.toLowerCase(),
        reason_json: pick.why,
      },
      { onConflict: "user_id,battle_date" }
    );
  } catch {
    // Cache is an optimisation, never a gate: the computed pick is already
    // correct, so only stability across refreshes is lost. Allow a retry.
    writtenPicks.delete(writeKey);
  }
}

/** Today's cached pick, if any. */
export async function getCachedDailyBattle(
  userId: string | null
): Promise<{ problemSlug: string; why: string[] } | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("daily_battles")
    .select("problem_slug, reason_json")
    .eq("user_id", userId)
    .eq("battle_date", today())
    .maybeSingle();
  if (!data) return null;
  const row = data as { problem_slug: string; reason_json: string[] | null };
  return {
    problemSlug: row.problem_slug.toLowerCase(),
    why: Array.isArray(row.reason_json) ? row.reason_json.slice(0, 3) : [],
  };
}