/**
 * LeetCode Public GraphQL Data Engine
 * Fetches profile stats, contest ranking, recent submissions, and calendar streaks.
 *
 * EXTERNAL DEPENDENCIES (undocumented-endpoint ban — see execution plan Step 0.5):
 * - POST https://leetcode.com/graphql — public, no auth. Operations:
 *   getUserProfile, getRecentSubmissions, userProfileCalendar,
 *   problemsetQuestionListV2. Rate: polite (~1 req/1.5s in cron, 12s timeout,
 *   300-600s ISR revalidate). Fallback when down: callers return null / keep
 *   last persisted stats (never regress cumulative totals); UI shows retry.
 * - GET/POST https://leetcode.com/accounts/login/ — credential login, returns
 *   LEETCODE_SESSION cookie. Optional enhancement only; app works without it.
 *   Risk: upstream captcha/2FA/layout change breaks login → lose evidence badge
 *   only, never identity/squads/notes/challenges (Bible §43).
 * - GET https://leetcode.com/api/problems/algorithms/ — session-cookie auth,
 *   returns full solved set. Returns null (not []) on expired session so
 *   callers distinguish "nothing solved" from "could not verify".
 */

import type { Difficulty } from "@/types/database";
import { isValidSlug } from "@/lib/slug";

export interface LeetCodeUserProfile {
  username: string;
  realName?: string;
  avatar?: string;
  ranking?: number; // Official LeetCode Profile Global Rank
  totalEasy: number;
  totalMedium: number;
  totalHard: number;
  totalSolved: number;
  acceptanceRate: number;
  contestRating?: number | null; // Official LeetCode Contest Rating; null = never competed
  contestGlobalRank?: number; // Official LeetCode Contest Global Ranking
  contestTotalParticipants?: number; // Official Contest Total Participants
  contestTopPercentage?: number; // Official Contest Top Percentage
  contestAttended?: number; // Official Contests Attended
}

export interface RecentSubmission {
  title: string;
  titleSlug: string;
  timestamp: string;
}

export interface UserCalendarStats {
  streak: number;
  totalActiveDays: number;
}

const LEETCODE_GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

// Hung upstream fetch must never block squad cron loop.
function leetcodeInit(body: unknown, opts?: { revalidate?: number; timeoutMs?: number; noStore?: boolean }): RequestInit {
  const init: RequestInit & { next?: { revalidate: number } } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 12000),
  };
  if (opts?.noStore) init.cache = "no-store";
  else if (opts?.revalidate != null) init.next = { revalidate: opts.revalidate };
  return init;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
const finiteOrUndef = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeUserProfile | null> {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          ranking
          userAvatar
          realName
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
          totalSubmissionNum {
            difficulty
            count
          }
        }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        totalParticipants
        topPercentage
        attendedContestsCount
      }
    }
  `;

  try {
    const res = await fetch(
      LEETCODE_GRAPHQL_ENDPOINT,
      leetcodeInit({ query, variables: { username } }, { revalidate: 300 })
    );

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`LeetCode profile HTTP ${res.status}`);

    const data = await res.json();
    const user = data?.data?.matchedUser;
    const contest = data?.data?.userContestRanking;

    if (!user) return null;

    const acStats = user.submitStats?.acSubmissionNum || [];
    const findCount = (diff: string) =>
      num(acStats.find((s: { difficulty: string }) => s.difficulty === diff)?.count);
    const totalEasy = findCount("Easy");
    const totalMedium = findCount("Medium");
    const totalHard = findCount("Hard");
    const totalSolved = findCount("All");

    const allSubmits = findCount("All") || 0;
    const rawRate = allSubmits > 0 ? (totalSolved / allSubmits) * 100 : 0;
    const acceptanceRate = Number.isFinite(rawRate)
      ? Math.min(100, Math.max(0, Math.round(rawRate)))
      : 0;

    const rating = finiteOrUndef(contest?.rating);
    const contestAttended = num(contest?.attendedContestsCount);
    const contestRating = contestAttended > 0 ? (rating != null ? Math.round(rating) : null) : null;

    return {
      username: user.username,
      realName: user.profile?.realName,
      avatar: user.profile?.userAvatar,
      ranking: finiteOrUndef(user.profile?.ranking), // Exact LeetCode Profile Global Rank (e.g. 2328998)
      totalEasy,
      totalMedium,
      totalHard,
      totalSolved,
      acceptanceRate,
      contestRating,
      contestGlobalRank: contestAttended > 0 ? finiteOrUndef(contest?.globalRanking) : undefined,
      contestTotalParticipants: contestAttended > 0 ? finiteOrUndef(contest?.totalParticipants) : undefined,
      contestTopPercentage:
        contestAttended > 0
          ? (() => {
              const p = finiteOrUndef(contest?.topPercentage);
              return p != null ? Math.min(100, Math.max(0, p)) : undefined;
            })()
          : undefined,
      contestAttended,
    };
  } catch (error) {
    console.error("Error fetching LeetCode profile:", error);
    throw error;
  }
}

export async function fetchRecentSubmissions(username: string): Promise<RecentSubmission[] | null> {
  const query = `
    query getRecentSubmissions($username: String!) {
      recentAcSubmissionList(username: $username, limit: 100) {
        title
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const res = await fetch(
      LEETCODE_GRAPHQL_ENDPOINT,
      leetcodeInit({ query, variables: { username } }, { revalidate: 30 })
    );

    if (!res.ok) throw new Error(`LeetCode recents HTTP ${res.status}`);

    const data = await res.json();
    return data?.data?.recentAcSubmissionList ?? null;
  } catch (error) {
    console.error("Error fetching recent submissions:", error);
    return null;
  }
}

export async function fetchUserCalendar(username: string): Promise<UserCalendarStats | null> {
  const query = `
    query userProfileCalendar($username: String!) {
      matchedUser(username: $username) {
        userCalendar {
          streak
          totalActiveDays
        }
      }
    }
  `;

  try {
    const res = await fetch(
      LEETCODE_GRAPHQL_ENDPOINT,
      leetcodeInit({ query, variables: { username } }, { revalidate: 600 })
    );

    if (!res.ok) throw new Error(`LeetCode calendar HTTP ${res.status}`);

    const data = await res.json();
    const cal = data?.data?.matchedUser?.userCalendar;
    if (!cal) return null;
    return {
      streak: num(cal.streak),
      totalActiveDays: num(cal.totalActiveDays),
    };
  } catch (error) {
    console.error("Error fetching user calendar:", error);
    return null;
  }
}

// ============================================================
// Full LeetCode Problem Catalog (all ~3500 problems + topic tags)
// ============================================================

export interface CatalogTopicTag {
  name: string;
  slug: string;
}

export interface CatalogProblem {
  titleSlug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  questionFrontendId: string;
  paidOnly: boolean;
  topicTags: CatalogTopicTag[];
}

const CATALOG_QUERY = `
  query problemsetQuestionListV2($limit: Int, $skip: Int) {
    problemsetQuestionListV2(limit: $limit, skip: $skip) {
      totalLength
      questions {
        title
        titleSlug
        difficulty
        questionFrontendId
        paidOnly
        topicTags {
          name
          slug
        }
      }
    }
  }
`;

function normalizeDifficulty(diff: string): Difficulty | null {
  const d = (diff || "").toUpperCase();
  if (d === "HARD") return "Hard";
  if (d === "MEDIUM") return "Medium";
  if (d === "EASY") return "Easy";
  return null;
}

export async function fetchProblemCatalogPage(
  skip: number,
  limit = 100
): Promise<CatalogProblem[] | null> {
  try {
    const res = await fetch(
      LEETCODE_GRAPHQL_ENDPOINT,
      leetcodeInit({ query: CATALOG_QUERY, variables: { limit, skip } }, { noStore: true })
    );

    if (!res.ok) throw new Error(`LeetCode catalog HTTP ${res.status}`);

    const json = await res.json();
    const rawQuestions: Array<{
      title: string;
      titleSlug: string;
      difficulty: string;
      questionFrontendId: string;
      paidOnly?: boolean;
      topicTags?: { name: string; slug: string }[];
    }> = json?.data?.problemsetQuestionListV2?.questions ?? [];

    const out: CatalogProblem[] = [];
    for (const q of rawQuestions) {
      const difficulty = normalizeDifficulty(q.difficulty);
      if (!difficulty || typeof q.titleSlug !== "string" || !q.titleSlug) continue;
      out.push({
        title: q.title,
        titleSlug: q.titleSlug,
        difficulty,
        questionFrontendId: q.questionFrontendId,
        paidOnly: !!q.paidOnly,
        topicTags: q.topicTags ?? [],
      });
    }
    return out;
  } catch (error) {
    console.error("Error fetching LeetCode catalog page:", error);
    return null;
  }
}

export async function fetchFullProblemCatalog(opts?: {
  pageSize?: number;
  maxPages?: number;
  onProgress?: (count: number) => void;
}): Promise<{ problems: CatalogProblem[]; complete: boolean }> {
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 60;
  const out: CatalogProblem[] = [];

  for (let skip = 0, page = 0; page < maxPages; page++) {
    const batch = await fetchProblemCatalogPage(skip, pageSize);
    if (batch === null) return { problems: out, complete: false };
    if (batch.length === 0) return { problems: out, complete: true };
    out.push(...batch);
    opts?.onProgress?.(out.length);
    if (batch.length < pageSize) return { problems: out, complete: true };
    skip += pageSize;
    // Small pause between pages to be polite to LeetCode API
    await new Promise((r) => setTimeout(r, 40));
  }

  return { problems: out, complete: true };
}

// ============================================================
// Authenticated LeetCode Session (full solved history)
// ============================================================

const LEETCODE_BASE = "https://leetcode.com";
const LEETCODE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function extractCookie(setCookieHeaders: string[] | undefined, name: string): string | null {
  if (!setCookieHeaders) return null;
  for (const header of setCookieHeaders) {
    const part = header.split(";")[0];
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    if (k === name) return part;
  }
  return null;
}

// Logs in with username+password and returns the LEETCODE_SESSION cookie string.
// Returns null on failure (bad creds, 2FA/captcha, or network error).
export async function loginLeetCode(username: string, password: string): Promise<string | null> {
  try {
    // 1. Fetch the login page to grab csrfToken + initial cookies.
    const pageRes = await fetch(`${LEETCODE_BASE}/accounts/login/`, {
      headers: { "User-Agent": LEETCODE_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const pageHtml = await pageRes.text();
    const csrfMatch = pageHtml.match(/name="csrfmiddlewaretoken"[^>]*value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1];
    if (!csrfToken) return null;

    const csrfCookie = extractCookie(pageRes.headers.getSetCookie?.(), "csrftoken");

    // 2. POST credentials.
    const body = new URLSearchParams({
      login: username,
      password,
      csrfmiddlewaretoken: csrfToken,
    });
    const loginRes = await fetch(`${LEETCODE_BASE}/accounts/login/`, {
      method: "POST",
      headers: {
        "User-Agent": LEETCODE_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${LEETCODE_BASE}/accounts/login/`,
        ...(csrfCookie ? { Cookie: csrfCookie } : {}),
      },
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const sessionCookie = extractCookie(loginRes.headers.getSetCookie?.(), "LEETCODE_SESSION");
    if (!sessionCookie) return null;
    return sessionCookie;
  } catch (error) {
    console.error("LeetCode login error:", error);
    return null;
  }
}

// Returns the title slugs of every problem the session user has Accepted.
// Returns null when the session is expired/invalid or the fetch fails, so
// callers can distinguish "nothing solved" from "could not verify".
export async function fetchSolvedSlugsFromSession(sessionCookie: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${LEETCODE_BASE}/api/problems/algorithms/`, {
      headers: {
        "User-Agent": LEETCODE_UA,
        Referer: `${LEETCODE_BASE}/problemset/all/`,
        Cookie: sessionCookie,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error(`LeetCode problems API HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const statStatusPairs = json?.stat_status_pairs ?? [];
    const solved: string[] = [];
    for (const pair of statStatusPairs) {
      if (pair?.status === "ac" && isValidSlug(pair.stat?.question__title_slug)) {
        solved.push(pair.stat.question__title_slug);
      }
    }
    return solved;
  } catch (error) {
    console.error("LeetCode solved fetch error:", error);
    return null;
  }
}
