import { NextResponse } from "next/server";
import { fetchLeetCodeProfile, fetchRecentSubmissions, fetchUserCalendar } from "@/lib/leetcode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
  }

  try {
    const [profile, recentSubmissions, calendar] = await Promise.all([
      fetchLeetCodeProfile(username),
      fetchRecentSubmissions(username),
      fetchUserCalendar(username),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "LeetCode user not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        calendar,
        recentSubmissions,
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

    const [profile, recentSubmissions, calendar] = await Promise.all([
      fetchLeetCodeProfile(username),
      fetchRecentSubmissions(username),
      fetchUserCalendar(username),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "User not found on LeetCode" }, { status: 404 });
    }

    // Auto-verify suggestions
    const verifiedSuggestions: string[] = [];
    if (pendingSuggestions.length > 0 && recentSubmissions.length > 0) {
      const recentSlugs = new Set(recentSubmissions.map((s) => s.titleSlug.toLowerCase()));

      for (const suggestion of pendingSuggestions) {
        if (recentSlugs.has(suggestion.problem_slug.toLowerCase())) {
          verifiedSuggestions.push(suggestion.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        ...profile,
        streak: calendar.streak,
        totalActiveDays: calendar.totalActiveDays,
      },
      recentSubmissions,
      verifiedSuggestions,
    });
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
