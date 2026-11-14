/**
 * Leaderboard wording that depends on what a number actually is.
 *
 * Pure and dependency-free so the smoke tests can import the real thing.
 */

/**
 * Unit for the "Verified solves" metric.
 *
 * - Last 7 days counts problem_events whose source is 'leetcode'. The server's
 *   evidence-label guard only keeps that source when a verified battle backs
 *   it, so those are verified for anyone.
 * - All time is the profile's LeetCode easy+medium+hard totals. Those come
 *   from a public handle anyone can type, so the word "verified" is earned
 *   only once the handle's ownership is proven (`leetcode_verified_at`).
 */
export function verifiedMetricUnit(
  period: "week" | "all",
  ownerVerified: boolean
): { long: string; short: string } {
  if (period === "week") return { long: "verified this week", short: "solves" };
  return ownerVerified
    ? { long: "verified solves", short: "solves" }
    : { long: "solves on LeetCode", short: "solves" };
}
