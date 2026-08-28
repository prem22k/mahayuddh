import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchLeetCodeProfile, fetchRecentSubmissions, fetchUserCalendar, fetchSolvedSlugsFromSession } from "@/lib/leetcode";
import { decryptSession } from "@/lib/leetcodeSession";
import type { Profile } from "@/types/database";

// Service-role client for server-triggered persistence (bypasses RLS, never ships to browser).
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function fetchLeetCode(username: string): Promise<{
  profile: NonNullable<Awaited<ReturnType<typeof fetchLeetCodeProfile>>>;
  recentSubmissions: Awaited<ReturnType<typeof fetchRecentSubmissions>>;
  calendar: Awaited<ReturnType<typeof fetchUserCalendar>>;
} | null> {
  const [profile, recentSubmissions, calendar] = await Promise.all([
    fetchLeetCodeProfile(username),
    fetchRecentSubmissions(username),
    fetchUserCalendar(username),
  ]);

  if (!profile) return null;
  return { profile, recentSubmissions, calendar };
}

// Persist fetched LeetCode stats to the matching squad profile (by leetcode_username).
async function persistStats(
  leetcodeUsername: string,
  stats: {
    totalEasy: number;
    totalMedium: number;
    totalHard: number;
    contestRating: number;
    contestGlobalRank?: number | null;
    ranking?: number | null;
    streak: number;
    avatar?: string | null;
  }
): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) {
    console.warn("Sync: SUPABASE_SERVICE_ROLE_KEY not configured; skipping persistence");
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, leetcode_username")
    .eq("leetcode_username", leetcodeUsername)
    .maybeSingle();

  if (!profile) {
    console.warn(`Sync: no squad profile for LeetCode handle ${leetcodeUsername}`);
    return false;
  }

  const updateData: Partial<Profile> = {
    total_easy: stats.totalEasy ?? 0,
    total_medium: stats.totalMedium ?? 0,
    total_hard: stats.totalHard ?? 0,
    contest_rating: stats.contestRating ?? 1500,
    global_rank: stats.contestGlobalRank ?? stats.ranking ?? null,
    streak: stats.streak ?? 0,
    last_synced_at: new Date().toISOString(),
  };
  if (stats.avatar) updateData.avatar_url = stats.avatar;

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", profile.id);

  if (error) {
    console.error("Sync persistence error:", error);
    return false;
  }
  return true;
}

// Mark suggestions addressed to this LeetCode handle as completed when their
// problem appears in the user's recent accepted submissions.
async function verifySuggestions(
  leetcodeUsername: string,
  recentSubmissions: { titleSlug: string }[]
): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("leetcode_username", leetcodeUsername)
    .maybeSingle();
  if (!profile) return 0;

  const recentSlugs = new Set(recentSubmissions.map((s) => s.titleSlug.toLowerCase()));

  const { data: pending } = await supabase
    .from("suggestions")
    .select("id, problem_slug")
    .eq("to_user", profile.id)
    .eq("status", "pending")
    .in("problem_slug", Array.from(recentSlugs));

  if (!pending || pending.length === 0) return 0;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("suggestions")
    .update({ status: "completed", completed_at: now })
    .in("id", pending.map((s) => s.id));

  if (error) {
    console.error("Suggestion verification error:", error);
    return 0;
  }
  return pending.length;
}

// Auto-mark solved from LeetCode recent accepted submissions without downgrading
// a manual "attempted" flag (uses the SECURITY DEFINER RPC).
async function inferSolvedFromLeetcode(
  leetcodeUsername: string,
  recentSubmissions: { titleSlug: string }[]
): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase || recentSubmissions.length === 0) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("leetcode_username", leetcodeUsername)
    .maybeSingle();
  if (!profile) return 0;

  const slugs = Array.from(
    new Set(recentSubmissions.map((s) => s.titleSlug.toLowerCase()))
  );

  const { error } = await supabase.rpc("mark_solved_from_leetcode", {
    p_user_id: profile.id,
    p_slugs: slugs,
  });

  if (error) {
    console.error("Infer solved error:", error);
    return 0;
  }
  return slugs.length;
}

// Incremental pull: if the profile has a stored (encrypted) LeetCode session, re-fetch the
// full solved set and mark any newly "ac" problems. True first-run completeness + counting on.
async function importSessionSolved(leetcodeUsername: string): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, leetcode_session_encrypted")
    .eq("leetcode_username", leetcodeUsername)
    .maybeSingle();
  if (!profile?.leetcode_session_encrypted) return 0;

  try {
    const sessionCookie = decryptSession(profile.leetcode_session_encrypted);
    const slugs = await fetchSolvedSlugsFromSession(sessionCookie);
    if (slugs.length === 0) return 0;

    const CHUNK = 500;
    let marked = 0;
    for (let i = 0; i < slugs.length; i += CHUNK) {
      const slice = slugs.slice(i, i + CHUNK);
      const { error } = await supabase.rpc("mark_solved_from_leetcode", {
        p_user_id: profile.id,
        p_slugs: slice,
      });
      if (!error) marked += slice.length;
    }
    return marked;
  } catch (error) {
    console.error("Session solved import error (session likely expired):", error);
    return 0;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
  }

  try {
    const data = await fetchLeetCode(username);
    if (!data) {
      return NextResponse.json({ error: "LeetCode user not found" }, { status: 404 });
    }

    // Cron-triggered background sync: persist stats when authorized with CRON_SECRET.
    const cronSecret = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    let persisted = false;
    let verified = 0;
    let inferred = 0;
    let sessionImported = 0;
    const profile = data.profile;
    if (profile && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
      persisted = await persistStats(username.trim(), {
        totalEasy: profile.totalEasy ?? 0,
        totalMedium: profile.totalMedium ?? 0,
        totalHard: profile.totalHard ?? 0,
        contestRating: profile.contestRating ?? 1500,
        contestGlobalRank: profile.contestGlobalRank ?? null,
        ranking: profile.ranking ?? null,
        streak: data.calendar.streak ?? 0,
        avatar: profile.avatar ?? null,
      });

      // Auto-verify suggestions: mark received challenges solved when the recent
      // accepted submissions include their problem slug.
      if (data.recentSubmissions.length > 0) {
        verified = await verifySuggestions(username.trim(), data.recentSubmissions);
        inferred = await inferSolvedFromLeetcode(username.trim(), data.recentSubmissions);
      }

      // Incremental full-history pull from the stored LeetCode session (if connected).
      sessionImported = await importSessionSolved(username.trim());
    }

    return NextResponse.json({
      success: true,
      persisted,
      verifiedSuggestions: verified,
      inferredSolved: inferred,
      sessionImported,
      data: {
        profile: data.profile,
        calendar: data.calendar,
        recentSubmissions: data.recentSubmissions,
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, pendingSuggestions = [] } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const data = await fetchLeetCode(username);
    if (!data) {
      return NextResponse.json({ error: "User not found on LeetCode" }, { status: 404 });
    }

    // 1. Persist live profile stats to squad profiles
    const persisted = await persistStats(username.trim(), {
      totalEasy: data.profile.totalEasy,
      totalMedium: data.profile.totalMedium,
      totalHard: data.profile.totalHard,
      contestRating: data.profile.contestRating ?? 1500,
      contestGlobalRank: data.profile.contestGlobalRank ?? null,
      ranking: data.profile.ranking ?? null,
      streak: data.calendar.streak ?? 0,
      avatar: data.profile.avatar ?? null,
    });

    // 2. Automatically infer and mark recent accepted questions as solved in user_problem_status
    let inferred = 0;
    let verified = 0;
    if (data.recentSubmissions.length > 0) {
      inferred = await inferSolvedFromLeetcode(username.trim(), data.recentSubmissions);
      verified = await verifySuggestions(username.trim(), data.recentSubmissions);
    }

    // Auto-verify suggestions the client passed in directly
    const verifiedSuggestions: string[] = [];
    if (pendingSuggestions.length > 0 && data.recentSubmissions.length > 0) {
      const recentSlugs = new Set(data.recentSubmissions.map((s) => s.titleSlug.toLowerCase()));
      for (const suggestion of pendingSuggestions) {
        if (recentSlugs.has(suggestion.problem_slug.toLowerCase())) {
          verifiedSuggestions.push(suggestion.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      persisted,
      inferredSolved: inferred,
      verifiedSuggestionsCount: verified,
      stats: {
        ...data.profile,
        streak: data.calendar.streak,
        totalActiveDays: data.calendar.totalActiveDays,
      },
      recentSubmissions: data.recentSubmissions,
      verifiedSuggestions,
    });
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
