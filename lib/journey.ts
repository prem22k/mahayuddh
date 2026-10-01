import type { Approach, Battle, ProblemEvent, StuckRequest, Suggestion } from "@/types/database";

/**
 * Personal Journey (Step 20, Bible §31).
 *
 * A 30-day view of one person's practice, as a projection over the same rows
 * everything else reads (§63 — no table). The plan asks for battles / solved /
 * patterns / approaches / challenges / revenge / squad battles.
 *
 * Deliberately not a score. It is a record of what happened, so it can be
 * compared against the previous month by the person reading it, not ranked
 * against anybody.
 */

export interface JourneyWindow {
  days: number;
  from: string;
  to: string;
}

export interface JourneyBody {
  window: JourneyWindow;
  username: string;
  battlesStarted: number;
  solved: number;
  failed: number;
  /** Distinct catalog patterns touched. */
  patterns: number;
  patternsList: string[];
  approachesWritten: number;
  challengesSent: number;
  challengesReceived: number;
  challengesAnswered: number;
  /** Problems failed at least once and later solved — the revenge loop closing. */
  revengesWon: number;
  stuckAsked: number;
  stuckResolved: number;
  /** Median solved duration across the window, or null when unrecorded. */
  medianSolveSec: number | null;
  fastestSolveSec: number | null;
  activeDays: number;
  /** One derived line. Never an adjective the numbers do not support. */
  summary: string;
}

export interface JourneyInput {
  days?: number;
  now?: Date;
  username: string;
  /** The subject's user id — challenge direction is per-row, so it is explicit. */
  userId: string;
  events: ProblemEvent[];
  battles: Battle[];
  approaches: Approach[];
  challenges: Suggestion[];
  stuck: StuckRequest[];
  /** slug -> pattern/topic, for counting distinct patterns. */
  problemPattern: Map<string, string>;
}

export function journeyWindow(days = 30, now: Date = new Date()): JourneyWindow {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  return { days, from: fromDate.toISOString().slice(0, 10), to };
}

function within(iso: string, w: JourneyWindow): boolean {
  const day = iso.slice(0, 10);
  return day >= w.from && day <= w.to;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function buildJourney(input: JourneyInput): JourneyBody {
  const now = input.now ?? new Date();
  const w = journeyWindow(input.days ?? 30, now);

  const events = input.events.filter((e) => within(e.created_at, w));
  const battles = input.battles.filter((b) => within(b.started_at, w));
  const approaches = input.approaches.filter((a) => within(a.created_at, w));
  const challenges = input.challenges.filter((c) => within(c.created_at, w));
  const stuck = input.stuck.filter((s) => within(s.created_at, w));

  const solvedEvents = events.filter((e) => e.kind === "solved" || e.kind === "revisited");
  const patterns = new Set<string>();
  for (const e of solvedEvents) {
    const p = input.problemPattern.get(e.problem_slug);
    if (p) patterns.add(p);
  }

  // Revenge: failed at least once, then solved — order matters.
  const failedFirst = new Set(
    events.filter((e) => e.kind === "failed").map((e) => e.problem_slug)
  );
  const solvedSet = new Set(solvedEvents.map((e) => e.problem_slug));
  const revengesWon = Array.from(solvedSet).filter((s) => failedFirst.has(s)).length;

  const solvedBattles = battles.filter((b) => b.outcome === "solved");
  const durations = solvedBattles
    .map((b) => b.duration_sec)
    .filter((d): d is number => d != null);

  const activeDays = new Set(events.map((e) => e.created_at.slice(0, 10))).size;

  const challengesSent = challenges.filter((c) => c.from_user === input.userId).length;
  const challengesReceived = challenges.filter((c) => c.to_user === input.userId).length;
  const challengesAnswered = challenges.filter(
    (c) => c.to_user === input.userId && c.status === "completed"
  ).length;

  const stuckAsked = stuck.length;
  const stuckResolved = stuck.filter((s) => s.status !== "open").length;

  // Summary states what happened; it does not grade it.
  //
  // Keyed off solves, not battles: a solve can be logged from the roadmap
  // matrix without ever opening a battle session, and saying "no battles"
  // next to three recorded solves would be plainly wrong.
  const nothingLogged = solvedEvents.length === 0 && battles.length === 0;
  const summary =
    nothingLogged
      ? `Nothing logged in the last ${w.days} days.`
      : stuckAsked > 0 && stuckResolved === stuckAsked && stuckAsked > 0
        ? `${solvedEvents.length} solves and every stuck request got answered.`
        : revengesWon > 0
          ? `${battles.length} battles, ${solvedEvents.length} solves, ${revengesWon} ${revengesWon === 1 ? "problem" : "problems"} failed then finished.`
          : `${battles.length} battles, ${solvedEvents.length} solves across ${patterns.size} ${patterns.size === 1 ? "pattern" : "patterns"}.`;

  return {
    window: w,
    username: input.username,
    battlesStarted: battles.length,
    solved: solvedEvents.length,
    failed: events.filter((e) => e.kind === "failed").length,
    patterns: patterns.size,
    patternsList: Array.from(patterns).sort(),
    approachesWritten: approaches.length,
    challengesSent,
    challengesReceived,
    challengesAnswered,
    revengesWon,
    stuckAsked,
    stuckResolved,
    medianSolveSec: median(durations),
    fastestSolveSec: durations.length ? Math.min(...durations) : null,
    activeDays,
    summary,
  };
}
