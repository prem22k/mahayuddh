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
    p_limit: opts.limit ?? 25,
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