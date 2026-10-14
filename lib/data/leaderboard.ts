import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";

/**
 * Global leaderboard segments (Step 23, Bible §34).
 *
 * §34 is about one feeling: a beginner should not open the global board and be
 * met with someone who has solved 2,000 problems. So the segments are the
 * product, and the default is chosen by how much the viewer has solved — not by
 * whoever is at the top of the pile.
 *
 * Sorting happens in SQL (public.global_leaderboard). Loading every profile and
 * sorting in the browser is what produced the problem.
 */

export type LeaderboardSegment = "rising" | "improved" | "pattern" | "recent" | "most_solved";

export interface LeaderboardSegmentInfo {
  id: LeaderboardSegment;
  label: string;
  /** What this view actually ranks by. Shown, so the ordering is not a mystery. */
  ranks: string;
}

export const LEADERBOARD_SEGMENTS: LeaderboardSegmentInfo[] = [
  { id: "rising", label: "Rising", ranks: "Solves in the last 30 days" },
  { id: "improved", label: "Most improved", ranks: "Problems that got measurably faster" },
  { id: "pattern", label: "By pattern", ranks: "Solves touching a pattern you pick" },
  { id: "recent", label: "Recently active", ranks: "Who has been logging at all" },
  { id: "most_solved", label: "Most solved", ranks: "Lifetime solves" },
];

export interface LeaderboardRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_solves: number;
  segment_value: number;
  segment_label: string;
  last_active_at: string | null;
}

export async function getGlobalLeaderboard(opts: {
  segment?: LeaderboardSegment;
  pattern?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: LeaderboardRow[]; segment: LeaderboardSegment }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ask the database which segment this viewer should land on, so the rule
  // lives in one place instead of being duplicated in this file and in the UI.
  let segment = opts.segment;
  if (!segment) {
    const { data } = await supabase.rpc("default_leaderboard_segment", { p_user: user?.id ?? null });
    segment = (data as LeaderboardSegment | null) ?? "rising";
  }

  const { data, error } = await supabase.rpc("global_leaderboard", {
    p_segment: segment,
    p_pattern: opts.pattern ?? null,
    p_limit: Math.min(opts.limit ?? 25, 100),
    p_offset: opts.offset ?? 0,
  });
  if (error) throw new DataError("leaderboard", "Couldn't load the leaderboard. Retry.", { cause: error });

  return { rows: (data ?? []) as LeaderboardRow[], segment };
}

/**
 * Which segment this viewer should land on, without loading the board.
 *
 * §34's rule in one place so the UI can explain itself: below 500 lifetime
 * solves, a week of real work should put somebody near the top of the view they
 * are given.
 */
export function defaultSegmentFor(lifetimeSolves: number | null | undefined): LeaderboardSegment {
  if (lifetimeSolves == null) return "rising";
  return lifetimeSolves >= 500 ? "most_solved" : "rising";
}

/** True when the viewer's view is the lifetime board, so the UI can say why. */
export function isLifetimeView(segment: LeaderboardSegment): boolean {
  return segment === "most_solved";
}

// ── Windowed squad-board counts ─────────────────────────────────────────────
// The squad leaderboard's "Last 7 days" scope ranks measured event windows,
// not profile lifetime totals. problem_events is publicly readable, so these
// run as the viewer; an empty squad is an empty map, never an error.

function emptyCounts(userIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of userIds) counts.set(id, 0);
  return counts;
}

/**
 * Verified solves per user since `sinceISO`: kind='solved' events whose
 * battle-derived metadata marks them LeetCode-verified (source='leetcode').
 * Counts client-side from the filtered rows.
 */
export async function getVerifiedSolvesWindow(
  userIds: string[],
  sinceISO: string
): Promise<Map<string, number>> {
  const counts = emptyCounts(userIds);
  if (userIds.length === 0) return counts;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("kind", "solved")
    .gte("created_at", sinceISO)
    .filter("metadata->>source", "eq", "leetcode");
  if (error) throw new DataError("leaderboard", "Couldn't load weekly verified solves. Retry.", { cause: error });
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * All solves per user since `sinceISO` (no source filter): the activity
 * fallback behind the week scope's streak-ish column.
 */
export async function getSolvesWindow(
  userIds: string[],
  sinceISO: string
): Promise<Map<string, number>> {
  const counts = emptyCounts(userIds);
  if (userIds.length === 0) return counts;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("kind", "solved")
    .gte("created_at", sinceISO);
  if (error) throw new DataError("leaderboard", "Couldn't load weekly activity. Retry.", { cause: error });
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  return counts;
}

// ── Rank snapshots (change indicators) ──────────────────────────────────────
// There is no rank-history source in the schema, so the board freezes one
// snapshot per (scope, metric, day) in leaderboard_snapshots and compares the
// current order against the latest snapshot before today.

export interface SnapshotRow {
  user_id: string;
  rank: number;
  value: number;
}

export interface PreviousRanks {
  ranks: Map<string, number>;
  /** Latest snapshot date strictly before today, or null when there is none. */
  snapshotDate: string | null;
}

function todayDateISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Previous frozen ranks for this scope+metric (latest date before today). */
export async function getPreviousSnapshotRanks(
  scope: string,
  metric: string,
  userIds: string[]
): Promise<PreviousRanks> {
  const ranks = new Map<string, number>();
  if (userIds.length === 0 || !scope || !metric) return { ranks, snapshotDate: null };
  const supabase = createClient();
  const today = todayDateISO();
  const { data, error } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id,rank,snapshot_date")
    .eq("scope", scope)
    .eq("metric", metric)
    .lt("snapshot_date", today)
    .in("user_id", userIds)
    .order("snapshot_date", { ascending: false })
    .limit(1000);
  if (error) throw new DataError("leaderboard", "Couldn't load rank movement. Retry.", { cause: error });
  const rows = (data ?? []) as Array<{ user_id: string; rank: number; snapshot_date: string }>;
  if (rows.length === 0) return { ranks, snapshotDate: null };
  const latest = rows[0].snapshot_date;
  for (const row of rows) {
    if (row.snapshot_date !== latest) break;
    if (!ranks.has(row.user_id)) ranks.set(row.user_id, row.rank);
  }
  return { ranks, snapshotDate: latest };
}

/**
 * Freeze today's ranks via the service route, once per (scope, metric, day).
 * Never throws: a failed write means the indicators honestly render "—".
 * Call fire-and-forget (`void snapshotRanks(...)`).
 */
export async function snapshotRanks(
  scope: string,
  metric: string,
  rows: SnapshotRow[]
): Promise<void> {
  try {
    if (rows.length === 0 || !scope || !metric) return;
    const supabase = createClient();
    const today = todayDateISO();
    const { data, error } = await supabase
      .from("leaderboard_snapshots")
      .select("id")
      .eq("scope", scope)
      .eq("metric", metric)
      .eq("snapshot_date", today)
      .limit(1);
    if (error) return;
    if (data && data.length > 0) return;
    await fetch("/api/leaderboard/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, metric, rows }),
    }).catch(() => undefined);
  } catch {
    // Intentionally silent: movement is decoration, the board is the product.
  }
}

/**
 * Change indicator for one row: previous frozen rank vs the current rank.
 * "New" when the read succeeded but this user has no prior rank; "—" when the
 * read itself failed, so a missing snapshot never poses as stability.
 */
export function rankChangeLabel(
  prevRank: number | undefined,
  currentRank: number,
  readOk: boolean
): string {
  if (prevRank == null) return readOk ? "New" : "—";
  const diff = prevRank - currentRank;
  if (diff > 0) return `↑${diff}`;
  if (diff < 0) return `↓${-diff}`;
  return "—";
}