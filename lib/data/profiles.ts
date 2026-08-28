import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

export async function getSquadProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("contest_rating", { ascending: false });

  if (error || !data || data.length === 0) {
    return [];
  }

  return data as Profile[];
}

export async function getProfileByLeetcodeUsername(leetcodeUsername: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("leetcode_username", leetcodeUsername)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function syncUserProfileStats(
  userId: string,
  leetcodeUsername: string
): Promise<Profile | null> {
  const supabase = createClient();

  try {
    const res = await fetch("/api/sync/leetcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: leetcodeUsername.trim() }),
    });

    if (!res.ok) {
      console.warn("Failed to fetch LeetCode stats from sync endpoint");
      return null;
    }

    const { stats } = await res.json();

    if (stats) {
      const updateData: Partial<Profile> = {
        leetcode_username: leetcodeUsername.trim(),
        total_easy: stats.totalEasy ?? 0,
        total_medium: stats.totalMedium ?? 0,
        total_hard: stats.totalHard ?? 0,
        contest_rating: stats.contestRating ?? 1500,
        global_rank: stats.contestGlobalRank ?? stats.ranking ?? null,
        streak: stats.streak ?? 0,
      };

      if (stats.avatar) {
        updateData.avatar_url = stats.avatar;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
        .select()
        .maybeSingle();

      if (!error && data) {
        return data as Profile;
      }
    }
  } catch (err) {
    console.error("Error syncing profile stats:", err);
  }

  return null;
}
