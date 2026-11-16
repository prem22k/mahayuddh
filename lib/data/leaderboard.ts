import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import type { LeaderboardMetric, LeaderboardWindow } from "@/lib/leaderboardLabels";

export type { LeaderboardMetric, LeaderboardWindow } from "@/lib/leaderboardLabels";

/**
 * Both leaderboard tabs read one SQL function, public.leaderboard. Global is
 * everyone; squad is the signed-in user's active squad, which the database
 * takes from the session (there is no squad parameter to point elsewhere).
 * Ranking, filters and pagination all happen there, so neither tab downloads
 * every profile to sort in the browser.
 */

export type LeaderboardScope = "global" | "squad";

export interface BoardRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  leetcode_username: string | null;
  leetcode_verified: boolean;
  /** Dense rank across the whole board, not just this page. */
  rank: number;
  /** null only for contest rating when the person is unrated. */
  value: number | null;
  /** Everyone on the board under these filters. */
  total_count: number;
}

export interface LeaderboardQuery {
  scope: LeaderboardScope;
  metric: LeaderboardMetric;
  window: LeaderboardWindow;
  pattern?: string | null;
  linkedOnly?: boolean;
  /** Just this person's row, ranked among everyone (the "you are #N" bar). */
  onlyUser?: string | null;
  limit?: number;
  offset?: number;
}

export async function getLeaderboard(q: LeaderboardQuery): Promise<{ rows: BoardRow[]; total: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("leaderboard", {
    p_scope: q.scope,
    p_metric: q.metric,
    p_window: q.window,
    p_pattern: q.pattern?.trim() || null,
    p_linked_only: q.linkedOnly ?? false,
    p_only_user: q.onlyUser ?? null,
    p_limit: Math.min(q.limit ?? 25, 100),
    p_offset: q.offset ?? 0,
  });
  if (error) throw new DataError("leaderboard", "Couldn't load the leaderboard. Retry.", { cause: error });
  const rows = (data ?? []) as BoardRow[];
  return { rows, total: rows[0]?.total_count ?? 0 };
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