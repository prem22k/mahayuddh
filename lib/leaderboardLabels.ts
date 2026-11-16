/**
 * Leaderboard wording that depends on what a number actually is.
 *
 * Pure and dependency-free so the smoke tests can import the real thing.
 */

export type LeaderboardMetric = "verified" | "solves" | "streak" | "hard" | "rating" | "improved" | "pattern";
export type LeaderboardWindow = "week" | "month" | "all";

/** Metrics the time window applies to; the rest are point-in-time values. */
export function isWindowed(metric: LeaderboardMetric): boolean {
  return metric === "verified" || metric === "solves" || metric === "improved" || metric === "pattern";
}

const WINDOW_PHRASE: Record<Exclude<LeaderboardWindow, "all">, string> = {
  week: "this week",
  month: "in 30 days",
};

/**
 * Unit for the "Verified solves" metric.
 *
 * - A window counts problem_events whose source is 'leetcode'. The server's
 *   evidence-label guard only keeps that source when a verified battle backs
 *   it, so those are verified for anyone.
 * - All time is the profile's LeetCode easy+medium+hard totals. Those come
 *   from a public handle anyone can type, so the word "verified" is earned
 *   only once the handle's ownership is proven (`leetcode_verified_at`).
 */
export function verifiedMetricUnit(
  period: LeaderboardWindow,
  ownerVerified: boolean
): { long: string; short: string } {
  if (period !== "all") return { long: `verified ${WINDOW_PHRASE[period]}`, short: "solves" };
  return ownerVerified
    ? { long: "verified solves", short: "solves" }
    : { long: "solves on LeetCode", short: "solves" };
}

/** Unit after a row's number: long on desktop, one word on phones. "1 solve", not "1 solves". */
export function metricUnit(
  metric: LeaderboardMetric,
  period: LeaderboardWindow,
  ownerVerified: boolean,
  pattern?: string | null,
  value?: number | null
): { long: string; short: string } {
  const unit = pluralUnit(metric, period, ownerVerified, pattern);
  if (value !== 1) return unit;
  const one = (s: string) => s.replace(/\bsolves\b/, "solve").replace(/^problems got/, "problem got");
  return { long: one(unit.long), short: one(unit.short) };
}

function pluralUnit(
  metric: LeaderboardMetric,
  period: LeaderboardWindow,
  ownerVerified: boolean,
  pattern?: string | null
): { long: string; short: string } {
  switch (metric) {
    case "verified":
      return verifiedMetricUnit(period, ownerVerified);
    case "solves":
      return { long: period === "all" ? "solves logged" : `solves ${WINDOW_PHRASE[period]}`, short: "solves" };
    case "streak":
      return { long: "day streak", short: "days" };
    case "hard":
      return { long: "hard solved", short: "hard" };
    case "rating":
      return { long: "rating", short: "rating" };
    case "improved":
      return { long: "problems got faster", short: "faster" };
    case "pattern":
      return { long: pattern ? `solves touching ${pattern}` : "pattern solves", short: "solves" };
  }
}

/** One sentence saying what the board is ranked by, so the order is never a mystery. */
export function rankingBasis(metric: LeaderboardMetric, period: LeaderboardWindow, pattern?: string | null): string {
  const when = period === "week" ? " in the last 7 days" : period === "month" ? " in the last 30 days" : "";
  switch (metric) {
    case "verified":
      return period === "all"
        ? "Ranked by lifetime LeetCode solves (easy + medium + hard) from sync."
        : `Ranked by LeetCode-verified solves${when}.`;
    case "solves":
      return period === "all" ? "Ranked by every solve and revisit logged here." : `Ranked by solves and revisits logged${when}.`;
    case "streak":
      return "Ranked by current daily streak. Streaks are a running count, so the time window does not apply.";
    case "hard":
      return "Ranked by lifetime hard problems solved on LeetCode. The time window does not apply.";
    case "rating":
      return "Ranked by LeetCode contest rating. The time window does not apply.";
    case "improved":
      return `Ranked by problems whose latest timed solve beat the first${when}.`;
    case "pattern":
      return pattern
        ? `Ranked by solves touching ${pattern}${when}.`
        : "Pick a pattern to rank by, for example Graphs.";
  }
}
