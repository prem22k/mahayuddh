import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

export const PUBLIC_PROFILE_COLUMNS =
  "id,username,leetcode_username,avatar_url,contest_rating,global_rank,streak,total_easy,total_medium,total_hard,contest_attended,contest_global_rank,contest_top_percentage,last_synced_at,created_at";

export async function getSquadProfiles(opts?: {
  limit?: number;
  offset?: number;
}): Promise<Profile[]> {
  const supabase = createClient();
  let query = supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS, { count: "exact" })
    .order("contest_rating", { ascending: false, nullsFirst: false });
  if (opts?.limit != null) query = query.range(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit - 1);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    if (error) console.error("getSquadProfiles error:", error.message);
    return [];
  }

  return data as Profile[];
}

export async function getProfileByLeetcodeUsername(leetcodeUsername: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
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
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/sync/leetcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ username: leetcodeUsername.trim() }),
    });

    if (!res.ok) {
      if (res.status === 429) throw res;
      console.warn("Failed to fetch LeetCode stats from sync endpoint");
      return null;
    }

    const { stats } = await res.json();

    if (stats) {
      // Server already persisted stats (single writer, incl. last_synced_at).
      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        return data as Profile;
      }
    }
  } catch (err) {
    // A thrown Response (429 cooldown) must propagate so callers can surface
    // Retry-After; every other failure degrades to null.
    if (err instanceof Response) throw err;
    console.error("Error syncing profile stats:", err);
  }

  return null;
}
