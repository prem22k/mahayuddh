/**
 * LeetCode Public GraphQL Data Engine
 * Fetches profile stats, contest ranking, recent submissions, and calendar streaks.
 */

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
