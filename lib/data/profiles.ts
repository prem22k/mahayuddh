import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

import { PUBLIC_PROFILE_COLUMNS } from "@/lib/data/profileColumns";

// The column lists live in profileColumns.ts so server routes and /api/health
// can import them without this browser module.
export { PUBLIC_PROFILE_COLUMNS, OWN_PROFILE_COLUMNS } from "@/lib/data/profileColumns";

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

  if (error) {
    throw new DataError("profiles", "Couldn't load squad profiles. Check your connection and retry.", { cause: error });
  }
  if (!data || data.length === 0) return [];

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
      if (res.status === 429 || res.status === 403) throw res;
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
        track("sync_completed", { userId });
        return data as Profile;
      }
    }
  } catch (err) {
    // A thrown Response (429 cooldown, 403 ownership) must propagate so callers can surface
    // errors through syncErrorMessage; every other failure degrades to null.
    if (err instanceof Response) throw err;
    console.error("Error syncing profile stats:", err);
  }

  return null;
}
