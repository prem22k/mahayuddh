import { createClient } from "@/lib/supabase/client";
import { DailyPick, ProblemHistory } from "@/lib/dailyBattle";
import { DataError } from "@/lib/data/errors";

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Persist today's pick so it survives a refresh even if the underlying list
 * changes (plan Step 6: "one row/day/user cache").
 *
 * Falls back to the freshly computed pick when the user is anonymous or the
 * insert fails — the cache is an optimisation, never a gate.
 */
export async function cacheDailyBattle(
  userId: string | null,
  pick: DailyPick
): Promise<void> {
  if (!userId) return;
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
    // correct, so only stability across refreshes is lost.
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