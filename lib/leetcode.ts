/**
 * LeetCode Public GraphQL Data Engine
 * Fetches profile stats, contest ranking, recent submissions, and calendar streaks.
 */

import type { Difficulty } from "@/types/database";

export interface LeetCodeUserProfile {
  username: string;
  realName?: string;
  avatar?: string;
  ranking?: number;
  totalEasy: number;
  totalMedium: number;
  totalHard: number;
  totalSolved: number;
  acceptanceRate: number;
  contestRating?: number;
  contestGlobalRank?: number;
  contestTopPercentage?: number;
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
      }
    }
  `;

  try {
    const res = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ query, variables: { username } }),
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!res.ok) return null;

    const data = await res.json();
    const user = data?.data?.matchedUser;
    const contest = data?.data?.userContestRanking;

    if (!user) return null;

    const acStats = user.submitStats?.acSubmissionNum || [];
    const totalEasy = acStats.find((s: { difficulty: string }) => s.difficulty === "Easy")?.count || 0;
    const totalMedium = acStats.find((s: { difficulty: string }) => s.difficulty === "Medium")?.count || 0;
    const totalHard = acStats.find((s: { difficulty: string }) => s.difficulty === "Hard")?.count || 0;
    const totalSolved = acStats.find((s: { difficulty: string }) => s.difficulty === "All")?.count || 0;

    const allSubmits = user.submitStats?.totalSubmissionNum?.find((s: { difficulty: string }) => s.difficulty === "All")?.count || 1;
    const acceptanceRate = Math.round((totalSolved / allSubmits) * 100);

    return {
      username: user.username,
      realName: user.profile?.realName,
      avatar: user.profile?.userAvatar,
      ranking: user.profile?.ranking,
      totalEasy,
      totalMedium,
      totalHard,
      totalSolved,
      acceptanceRate,
      contestRating: contest?.rating ? Math.round(contest.rating) : 1500,
      contestGlobalRank: contest?.globalRanking,
      contestTopPercentage: contest?.topPercentage,
    };
  } catch (error) {
    console.error("Error fetching LeetCode profile:", error);
    return null;
  }
}

export async function fetchRecentSubmissions(username: string): Promise<RecentSubmission[]> {
  const query = `
    query getRecentSubmissions($username: String!) {
      recentAcSubmissionList(username: $username, limit: 20) {
        title
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const res = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ query, variables: { username } }),
      next: { revalidate: 120 }, // Cache for 2 minutes
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data?.data?.recentAcSubmissionList || [];
  } catch (error) {
    console.error("Error fetching recent submissions:", error);
    return [];
  }
}

export async function fetchUserCalendar(username: string): Promise<UserCalendarStats> {
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
    const res = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ query, variables: { username } }),
      next: { revalidate: 600 },
    });

    if (!res.ok) return { streak: 0, totalActiveDays: 0 };

    const data = await res.json();
    const cal = data?.data?.matchedUser?.userCalendar;
    return {
      streak: cal?.streak || 0,
      totalActiveDays: cal?.totalActiveDays || 0,
    };
  } catch (error) {
    console.error("Error fetching user calendar:", error);
    return { streak: 0, totalActiveDays: 0 };
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

function normalizeDifficulty(diff: string): Difficulty {
  const d = (diff || "").toUpperCase();
  if (d === "HARD") return "Hard";
  if (d === "MEDIUM") return "Medium";
  return "Easy";
}

export async function fetchProblemCatalogPage(
  skip: number,
  limit = 100
): Promise<CatalogProblem[]> {
  try {
    const res = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        query: CATALOG_QUERY,
        variables: { limit, skip },
      }),
    });

    if (!res.ok) {
      console.error(`LeetCode catalog HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const rawQuestions: Array<{
      title: string;
      titleSlug: string;
      difficulty: string;
      questionFrontendId: string;
      paidOnly?: boolean;
      topicTags?: { name: string; slug: string }[];
    }> = json?.data?.problemsetQuestionListV2?.questions ?? [];

    return rawQuestions.map((q) => ({
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: normalizeDifficulty(q.difficulty),
      questionFrontendId: q.questionFrontendId,
      paidOnly: !!q.paidOnly,
      topicTags: q.topicTags ?? [],
    }));
  } catch (error) {
    console.error("Error fetching LeetCode catalog page:", error);
    return [];
  }
}

export async function fetchFullProblemCatalog(opts?: {
  pageSize?: number;
  maxPages?: number;
  onProgress?: (count: number) => void;
}): Promise<CatalogProblem[]> {
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 60;
  const out: CatalogProblem[] = [];

  for (let skip = 0, page = 0; page < maxPages; page++) {
    const batch = await fetchProblemCatalogPage(skip, pageSize);
    if (batch.length === 0) break;
    out.push(...batch);
    opts?.onProgress?.(out.length);
    if (batch.length < pageSize) break;
    skip += pageSize;
    // Small pause between pages to be polite to LeetCode API
    await new Promise((r) => setTimeout(r, 40));
  }

  return out;
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
export async function fetchSolvedSlugsFromSession(sessionCookie: string): Promise<string[]> {
  try {
    const res = await fetch(`${LEETCODE_BASE}/api/problems/algorithms/`, {
      headers: {
        "User-Agent": LEETCODE_UA,
        Referer: `${LEETCODE_BASE}/problemset/all/`,
        Cookie: sessionCookie,
      },
    });
    if (!res.ok) {
      console.error(`LeetCode problems API HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const statStatusPairs = json?.stat_status_pairs ?? [];
    const solved: string[] = [];
    for (const pair of statStatusPairs) {
      if (pair?.status === "ac") {
        solved.push(pair.stat?.question__title_slug);
      }
    }
    return solved.filter(Boolean);
  } catch (error) {
    console.error("LeetCode solved fetch error:", error);
    return [];
  }
}
