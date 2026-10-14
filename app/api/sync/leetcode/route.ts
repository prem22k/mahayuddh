import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
  isAuthorizedCron,
  type ServiceClient,
} from "@/lib/supabase/service";
import { fetchLeetCodeProfile, fetchRecentSubmissions, fetchUserCalendar, fetchSolvedSlugsFromSession } from "@/lib/leetcode";
import { decryptSession } from "@/lib/leetcodeSession";
import { readJsonBounded } from "@/lib/security/body";
import type { Profile } from "@/types/database";

// Squad-wide GET fans out to LeetCode per handle with a 1.5s politeness
// delay, so large squads exceed Vercel Hobby's 10s cap. Cron-only path:
// invoked by GitHub Actions, never from the UI. `?limit=&offset=` lets the
// caller page through handles to stay under the timeout. maxDuration
// applies on Pro/Render; on Hobby the cron caller pages via limit/offset.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function fetchLeetCode(username: string): Promise<{
  profile: NonNullable<Awaited<ReturnType<typeof fetchLeetCodeProfile>>>;
  recentSubmissions: Awaited<ReturnType<typeof fetchRecentSubmissions>>;
  calendar: Awaited<ReturnType<typeof fetchUserCalendar>>;
} | null> {
  try {
    const [profile, recentSubmissions, calendar] = await Promise.all([
      fetchLeetCodeProfile(username),
      fetchRecentSubmissions(username),
      fetchUserCalendar(username),
    ]);

    if (!profile) return null;
    return { profile, recentSubmissions, calendar };
  } catch {
    return null;
  }
}

// Cron lookups match the trigger-normalized (lowered) handle exactly — same
// as verify/infer — so mixed-case handles can't persist-miss while verifying.
async function persistStatsByHandle(
  supabase: ServiceClient,
  leetcodeUsername: string,
  stats: {
    totalEasy: number;
    totalMedium: number;
    totalHard: number;
    contestRating?: number | null;
    contestGlobalRank?: number | null;
    contestTotalParticipants?: number | null;
    contestTopPercentage?: number | null;
    contestAttended?: number | null;
    ranking?: number | null;
    /** Null/undefined = calendar fetch failed: do not touch the stored streak. */
    streak?: number | null;
    avatar?: string | null;
  },
  prev: { total_easy: number; total_medium: number; total_hard: number; streak: number } | null
): Promise<boolean> {
  const attended = stats.contestAttended ?? 0;
  const nowISO = new Date().toISOString();
  const updateData: Partial<Profile> & { streak_updated_at?: string | null } = {
    // LeetCode totals are cumulative: never regress on a partial upstream
    // failure (already filtered upstream, belt + suspenders here).
    total_easy: Math.max(prev?.total_easy ?? 0, stats.totalEasy ?? 0),
    total_medium: Math.max(prev?.total_medium ?? 0, stats.totalMedium ?? 0),
    total_hard: Math.max(prev?.total_hard ?? 0, stats.totalHard ?? 0),
    // Never-competed users stay null so they can't masquerade as true 1500s.
    contest_rating: attended > 0 ? (stats.contestRating ?? null) : null,
    global_rank: stats.ranking ?? null, // Official LeetCode Profile Global Rank (e.g. 2328998)
    contest_attended: attended,
    contest_global_rank: attended > 0 ? (stats.contestGlobalRank ?? null) : null,
    contest_top_percentage: attended > 0 ? (stats.contestTopPercentage ?? null) : null,
    last_synced_at: nowISO,
  };
  // Streak is NOT cumulative: a real decrease (broken streak) must land.
  // A missing streak means the calendar fetch failed — never treat it as 0.
  if (typeof stats.streak === "number" && Number.isFinite(stats.streak) && stats.streak >= 0) {
    updateData.streak = Math.trunc(stats.streak);
    updateData.streak_updated_at = nowISO;
  }
  if (stats.avatar) updateData.avatar_url = stats.avatar;

  const handle = leetcodeUsername.trim().toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, total_easy, total_medium, total_hard, streak")
    .eq("leetcode_username", handle)
    .maybeSingle();

  if (!profile) {
    console.warn(`Sync: no squad profile for LeetCode handle ${leetcodeUsername}`);
    return false;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", profile.id);

  if (error) {
    // streak_updated_at lands with its migration; until then, retry without it
    // rather than failing the whole sync.
    if (updateData.streak_updated_at && /streak_updated_at/i.test(error.message)) {
      const { streak_updated_at: _drop, ...withoutStamp } = updateData;
      const { error: retryErr } = await supabase
        .from("profiles")
        .update(withoutStamp)
        .eq("id", profile.id);
      if (retryErr) {
        console.error("Sync persistence error:", retryErr);
        return false;
      }
      return true;
    }
    console.error("Sync persistence error:", error);
    return false;
  }
  return true;
}

// Persist fetched LeetCode stats to the matching squad profile (by leetcode_username).
async function persistStats(
  leetcodeUsername: string,
  stats: {
    totalEasy: number;
    totalMedium: number;
    totalHard: number;
    contestRating?: number | null;
    contestGlobalRank?: number | null;
    contestTotalParticipants?: number | null;
    contestTopPercentage?: number | null;
    contestAttended?: number | null;
    ranking?: number | null;
    /** Null/undefined = calendar fetch failed: do not touch the stored streak. */
    streak?: number | null;
    avatar?: string | null;
  },
  opts?: { userId?: string }
): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) {
    console.warn("Sync: SUPABASE_SERVICE_ROLE_KEY not configured; skipping persistence");
    return false;
  }
  if (!opts?.userId) {
    return persistStatsByHandle(supabase, leetcodeUsername, stats, null);
  }

  const attended = stats.contestAttended ?? 0;
  const { data: prev } = await supabase
    .from("profiles")
    .select("total_easy, total_medium, total_hard, streak")
    .eq("id", opts.userId)
    .maybeSingle();

  const nowISO = new Date().toISOString();
  const updateData: Partial<Profile> & { streak_updated_at?: string | null } = {
    total_easy: Math.max(prev?.total_easy ?? 0, stats.totalEasy ?? 0),
    total_medium: Math.max(prev?.total_medium ?? 0, stats.totalMedium ?? 0),
    total_hard: Math.max(prev?.total_hard ?? 0, stats.totalHard ?? 0),
    // Never-competed users stay null so they can't masquerade as true 1500s.
    contest_rating: attended > 0 ? (stats.contestRating ?? null) : null,
    global_rank: stats.ranking ?? null, // Official LeetCode Profile Global Rank (e.g. 2328998)
    contest_attended: attended,
    contest_global_rank: attended > 0 ? (stats.contestGlobalRank ?? null) : null,
    contest_top_percentage: attended > 0 ? (stats.contestTopPercentage ?? null) : null,
    last_synced_at: nowISO,
  };
  // Streak is NOT cumulative: a real decrease (broken streak) must land.
  // A missing streak means the calendar fetch failed — never treat it as 0.
  if (typeof stats.streak === "number" && Number.isFinite(stats.streak) && stats.streak >= 0) {
    updateData.streak = Math.trunc(stats.streak);
    updateData.streak_updated_at = nowISO;
  }
  if (stats.avatar) updateData.avatar_url = stats.avatar;

  // Authenticated self-sync: write by user id (also claims handle on first connect).
  // Single server-side writer; clients never update stats directly.
  updateData.leetcode_username = leetcodeUsername.trim().toLowerCase();
  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", opts.userId);

  if (error) {
    // streak_updated_at lands with its migration; until then, retry without it
    // rather than failing the whole sync.
    if (updateData.streak_updated_at && /streak_updated_at/i.test(error.message)) {
      const { streak_updated_at: _drop, ...withoutStamp } = updateData;
      const { error: retryErr } = await supabase
        .from("profiles")
        .update(withoutStamp)
        .eq("id", opts.userId);
      if (retryErr) {
        console.error("Sync persistence error:", retryErr);
        return false;
      }
      return true;
    }
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
    .eq("leetcode_username", leetcodeUsername.trim().toLowerCase())
    .maybeSingle();
  if (!profile) return 0;

  const recentSlugs = new Set(recentSubmissions.map((s) => s.titleSlug.toLowerCase()));

  const { data: pending } = await supabase
    .from("suggestions")
    .select("id, problem_slug, from_user")
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
  // Timeline: auto-verified completions append history like manual ones.
  await supabase.from("problem_events").insert(
    pending.map((s) => ({
      user_id: profile.id,
      problem_slug: s.problem_slug,
      kind: "challenge_completed",
      metadata: { source: "leetcode" },
    }))
  );

  // Squad activity from LeetCode verification (anti-ghost, §50). Without this a
  // squad that syncs purely via LeetCode shows an empty feed.
  const { data: prof } = await supabase
    .from("profiles")
    .select("active_squad_id")
    .eq("id", profile.id)
    .maybeSingle();
  const squadId = (prof as { active_squad_id: string | null } | null)?.active_squad_id;
  if (squadId) {
    await supabase.from("feed_events").insert(
      pending.map((s) => ({
        user_id: profile.id,
        event_type: "complete",
        squad_id: squadId,
        object_type: "suggestion",
        object_id: s.id,
        problem_slug: s.problem_slug,
        metadata: { source: "leetcode" },
      }))
    );
  }

  // The sender is owed an answer.
  for (const s of pending) {
    try {
      await supabase.from("notifications").insert({
        user_id: s.from_user,
        kind: "challenge_completed",
        title: "Challenge completed",
        body: `Verified on LeetCode.`,
        deep_link: `/c/${s.id}`,
        actor_id: profile.id,
      });
    } catch {
      // Best-effort: never block the verification pass.
    }
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
    .eq("leetcode_username", leetcodeUsername.trim().toLowerCase())
    .maybeSingle();
  if (!profile) return 0;

  const slugs = Array.from(
    new Set(recentSubmissions.map((s) => s.titleSlug.toLowerCase()))
  );

  const { data, error } = await supabase.rpc("mark_solved_from_leetcode", {
    p_user_id: profile.id,
    p_slugs: slugs,
  });

  if (error) {
    console.error("Infer solved error:", error);
    return 0;
  }
  // RPC returns rows actually inserted/promoted — not the input size.
  return typeof data === "number" ? data : 0;
}

// Incremental pull: if the profile has a stored (encrypted) LeetCode session, re-fetch the
// full solved set and mark any newly "ac" problems. True first-run completeness + counting on.
async function importSessionSolved(leetcodeUsername: string): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, leetcode_session_encrypted")
    .eq("leetcode_username", leetcodeUsername.trim().toLowerCase())
    .maybeSingle();
  if (!profile?.leetcode_session_encrypted) return 0;

  try {
    const sessionCookie = decryptSession(profile.leetcode_session_encrypted);
    const slugs = await fetchSolvedSlugsFromSession(sessionCookie);
    if (!slugs || slugs.length === 0) return 0;

    const CHUNK = 500;
    let marked = 0;
    for (let i = 0; i < slugs.length; i += CHUNK) {
      const slice = slugs.slice(i, i + CHUNK);
      const { data, error } = await supabase.rpc("mark_solved_from_leetcode", {
        p_user_id: profile.id,
        p_slugs: slice,
      });
      if (error) continue;
      marked += typeof data === "number" ? data : 0;
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

  try {
    // Cron-triggered squad sync: no username param = sync every claimed handle.
    if (!isAuthorizedCron(request)) {
      if (!username) {
        return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
      }
      const data = await fetchLeetCode(username);
      if (!data) {
        return NextResponse.json({ error: "LeetCode user not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        persisted: false,
        data: {
          profile: data.profile,
          calendar: data.calendar,
          recentSubmissions: data.recentSubmissions,
        },
      });
    }

    const service = getServiceClient();
    const allHandles = username
      ? [username.trim()]
      : service
        ? ((await service.from("profiles").select("leetcode_username").not("leetcode_username", "is", null)).data || [])
            .map((r) => r.leetcode_username as string | null)
            .filter((h): h is string => !!h)
        : [];
    // Paging keeps each invocation under serverless timeouts: with a 1.5s
    // politeness delay, ~5 handles ≈ 8s. Cron pages with ?limit=5&offset=N.
    // No limit param = legacy behaviour (whole squad in one call).
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");
    const limit = limitRaw === null ? allHandles.length : Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 50);
    const offset = Math.max(parseInt(offsetRaw ?? "0", 10) || 0, 0);
    const handles = allHandles.slice(offset, offset + limit);
    const totalHandles = allHandles.length;
    // Politeness delay between LeetCode hits so squad scale doesn't throttle.
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let persisted = 0;
    let verified = 0;
    let inferred = 0;
    let sessionImported = 0;
    const failed: string[] = [];
    for (const handle of handles) {
      try {
        const data = await fetchLeetCode(handle);
        if (!data || !data.calendar || !data.recentSubmissions) {
          failed.push(handle);
          continue;
        }
        const ok = await persistStats(handle, {
          totalEasy: data.profile.totalEasy ?? 0,
          totalMedium: data.profile.totalMedium ?? 0,
          totalHard: data.profile.totalHard ?? 0,
          contestRating: data.profile.contestRating ?? null,
          contestGlobalRank: data.profile.contestGlobalRank ?? null,
          contestTopPercentage: data.profile.contestTopPercentage ?? null,
          contestAttended: data.profile.contestAttended ?? 0,
          ranking: data.profile.ranking ?? null,
          streak: data.calendar.streak,
          avatar: data.profile.avatar ?? null,
        });
        if (ok) persisted += 1;
        else failed.push(handle);

        if (data.recentSubmissions.length > 0) {
          verified += await verifySuggestions(handle, data.recentSubmissions);
          inferred += await inferSolvedFromLeetcode(handle, data.recentSubmissions);
        }
        sessionImported += await importSessionSolved(handle);
      } catch (err) {
        console.error(`Squad sync failed for ${handle}:`, err);
        failed.push(handle);
      }
      await delay(1500);
    }

    return NextResponse.json({
      success: true,
      persisted,
      verifiedSuggestions: verified,
      inferredSolved: inferred,
      sessionImported,
      synced: handles.length,
      totalHandles,
      offset,
      hasMore: offset + handles.length < totalHandles,
      failed,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Bounded read: this route is a credentialed sync, so an unbounded body is
    // both a memory-exhaustion vector and an unauthenticated upstream-call
    // amplifier if the auth check below were ever moved after the parse.
    const parsed = await readJsonBounded<{ username?: unknown }>(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }
    const { username } = parsed.value ?? {};

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    // Persisting squad stats is an authenticated write: require the caller's
    // Supabase JWT (Bearer) or server session cookies. Reads of public LeetCode
    // data stay open via GET; POST must prove ownership.
    const token = extractBearerToken(request);
    const authedUser = await resolveUser(token);
    const authedUserId = authedUser?.id ?? null;
    if (!authedUserId) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    // Throttle: at most one sync per user per 60s (LeetCode + write protection).
    // Read-only check here; the stamp lands after ownership verification so
    // rejected (403/404) requests don't burn the caller's cooldown.
    const SYNC_COOLDOWN_MS = 60_000;
    const service = getServiceClient();
    if (service) {
      const { data: limit } = await service
        .from("sync_rate_limits")
        .select("last_sync_at")
        .eq("user_id", authedUserId)
        .maybeSingle();
      if (limit?.last_sync_at) {
        const elapsed = Date.now() - new Date(limit.last_sync_at).getTime();
        if (elapsed < SYNC_COOLDOWN_MS) {
          const retryAfter = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json(
            { error: `Sync on cooldown. Retry in ${retryAfter}s.` },
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }
      }
    }

    // Ownership check: only allow syncing a handle linked to the caller's
    // own profile, or a handle not yet claimed by anyone (first-connect flow).
    // Stored lowered by the DB trigger, so exact match == case-insensitive.
    if (service) {
      const { data: owner } = await service
        .from("profiles")
        .select("id")
        .eq("leetcode_username", username.trim().toLowerCase())
        .maybeSingle();
      if (owner && owner.id !== authedUserId) {
        return NextResponse.json({ error: "Forbidden. This LeetCode handle belongs to another squad member." }, { status: 403 });
      }
      await service
        .from("sync_rate_limits")
        .upsert({ user_id: authedUserId, last_sync_at: new Date().toISOString() }, { onConflict: "user_id" });
    }

    const data = await fetchLeetCode(username);
    if (!data || !data.calendar || !data.recentSubmissions) {
      return NextResponse.json({ error: "User not found on LeetCode" }, { status: 404 });
    }

    // 1. Persist live profile stats to squad profiles (claims handle on first connect)
    const persisted = await persistStats(username.trim(), {
      totalEasy: data.profile.totalEasy,
      totalMedium: data.profile.totalMedium,
      totalHard: data.profile.totalHard,
      contestRating: data.profile.contestRating ?? null,
      contestGlobalRank: data.profile.contestGlobalRank ?? null,
      contestTopPercentage: data.profile.contestTopPercentage ?? null,
      contestAttended: data.profile.contestAttended ?? 0,
      ranking: data.profile.ranking ?? null,
      streak: data.calendar.streak,
      avatar: data.profile.avatar ?? null,
    }, { userId: authedUserId });

    // 2. Verify + infer ONLY from LeetCode-proof recent submissions. Self-attested
    // rows are never trusted here — that was a full verify bypass.
    let inferred = 0;
    let verified = 0;
    const verifySlugs = data.recentSubmissions;
    if (data.recentSubmissions.length > 0) {
      inferred = await inferSolvedFromLeetcode(username.trim(), data.recentSubmissions);
      verified = await verifySuggestions(username.trim(), verifySlugs);
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
    });
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
