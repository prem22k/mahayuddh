import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";

export interface MyStreak {
  /** Consecutive IST days with a solve, ending today or yesterday. 0 when broken. */
  current: number;
  /** Longest run of such days. */
  best: number;
  solvedToday: boolean;
}

/**
 * Your own streak from your solves here (public.my_streak), on the squad
 * grid's IST days. Not profiles.streak: that is LeetCode's longest streak,
 * refreshed only by a sync.
 */
export async function getMyStreak(): Promise<MyStreak> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_streak");
  if (error) throw new DataError("streak", "Couldn't load your streak. Retry.", { cause: error });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { current_streak: number; best_streak: number; solved_today: boolean }
    | undefined;
  return {
    current: row?.current_streak ?? 0,
    best: row?.best_streak ?? 0,
    solvedToday: row?.solved_today ?? false,
  };
}
