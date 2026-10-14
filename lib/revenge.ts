import { daysBetween, formatDuration, relativeDays, titleFromSlug } from "./format.ts";
import type { Battle } from "@/types/database";

/**
 * REVENGE (Step 17, Bible §11).
 *
 * A failed problem is the strongest return reason the product has: the user
 * already knows they cannot solve it, so coming back has an obvious purpose.
 * The plan asks for:
 *
 *   REVENGE AVAILABLE — Trapping Rain Water — Previous 41:06 Failed — 19 days ago
 *   REVENGE COMPLETE  Previous Failed 41:06 -> Solved 28:11
 *
 * Both are derived from `battles` rows. No new table (§63): a revenge is not a
 * durable entity, it is a relationship between a failure and the solve that
 * followed it.
 */

export interface RevengeOffer {
  problemSlug: string;
  title: string;
  /** Duration of the most recent failed attempt, or null when unrecorded. */
  previousFailedSec: number | null;
  previousFailedAt: string;
  daysAgo: number;
  /** Failed attempts on record — the honest "how bad was it" number. */
  failureCount: number;
}

export interface RevengeResult {
  problemSlug: string;
  title: string;
  previousFailedSec: number | null;
  solvedSec: number | null;
  /** Null unless both durations exist — never claim a speedup we can't measure. */
  improvementSec: number | null;
  improved: boolean;
  solvedAt: string;
}

/** Most recent failed attempt for a slug, plus its count. */
export function latestFailure(battles: Battle[]): {
  latest: Battle | null;
  failureCount: number;
} {
  const failures = battles
    .filter((b) => b.outcome === "failed")
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return { latest: failures[0] ?? null, failureCount: failures.length };
}

/**
 * Build a revenge offer from raw session rows. Pure so the copy is testable:
 * every label here is derived from a real row.
 */
export function buildRevengeOffer(
  problemSlug: string,
  battles: Battle[],
  title?: string | null,
  now: Date = new Date()
): RevengeOffer | null {
  const { latest, failureCount } = latestFailure(battles);
  if (!latest) return null;

  const failedAt = new Date(latest.started_at).getTime();
  const daysAgo = daysBetween(failedAt, now);

  return {
    problemSlug: problemSlug.toLowerCase(),
    title: title || titleFromSlug(problemSlug),
    previousFailedSec: latest.duration_sec,
    previousFailedAt: latest.started_at,
    daysAgo,
    failureCount,
  };
}

/**
 * Compare a fresh solve against the failure it answers.
 *
 * `improved` is false when either duration is unknown. Inventing a speedup from
 * a missing number is exactly the dishonesty §44 forbids, so the card renders
 * "Previous failed (time not recorded)" instead of a fake delta.
 */
export function buildRevengeResult(
  problemSlug: string,
  solved: Battle,
  allBattles: Battle[],
  title?: string | null
): RevengeResult | null {
  const { latest } = latestFailure(allBattles);
  if (!latest) return null;

  // Only a solve that came *after* the failure counts as revenge.
  const solvedAt = new Date(solved.started_at).getTime();
  const failedAt = new Date(latest.started_at).getTime();
  if (solvedAt < failedAt) return null;

  const previousFailedSec = latest.duration_sec;
  const solvedSec = solved.outcome === "solved" ? solved.duration_sec : null;
  const improvementSec =
    previousFailedSec != null && solvedSec != null ? previousFailedSec - solvedSec : null;

  return {
    problemSlug: problemSlug.toLowerCase(),
    title: title || titleFromSlug(problemSlug),
    previousFailedSec,
    solvedSec,
    improvementSec,
    improved: improvementSec != null && improvementSec > 0,
    solvedAt: solved.started_at,
  };
}

/** "41:06 failed · 19 days ago" — the label the plan specifies. */
export function revengeLabel(offer: RevengeOffer): string {
  const dur = formatDuration(offer.previousFailedSec);
  const when = relativeDays(offer.daysAgo);
  if (!dur) return `Failed · ${when}`;
  return `${dur} failed · ${when}`;
}

/** "Previous failed 41:06 → solved 28:11". */
export function revengeResultLabel(result: RevengeResult): string {
  const prev = formatDuration(result.previousFailedSec) ?? "time not recorded";
  const now = formatDuration(result.solvedSec) ?? "time not recorded";
  return `Previous failed ${prev} → solved ${now}`;
}
