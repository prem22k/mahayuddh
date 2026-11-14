/**
 * Pattern mastery and the Practice roadmap's grouping.
 *
 * Pure and import-free so tests/smoke.test.mjs can load it directly.
 *
 * Mastered, for a primer with a practice ladder, means all of:
 *   1. coverage   at least 80% of the ladder solved (rounded up), including a
 *                 stretch problem: the hard ones are where a pattern gets twisted
 *   2. no recent  no failed attempt on a ladder problem in the last 30 days
 *      failures   (otherwise it would read Mastered and Weak at once)
 *   3. retention  one ladder problem solved again 7+ days after its first solve
 * Once mastered_at is stored it stays; the roadmap then nudges a revision when
 * nothing on the ladder has been solved for 45 days.
 */

export interface LadderItem {
  slug: string;
  tier?: "warm-up" | "core" | "stretch";
}

export interface SolveStatus {
  problem_slug: string;
  status: string;
  solved_at: string | null;
}

export interface SolveEvent {
  problem_slug: string;
  kind: string;
  created_at: string;
}

export interface Mastery {
  solved: number;
  total: number;
  /** Solves needed for the coverage rule. */
  need: number;
  mastered: boolean;
  /** What's still missing, in the order a reader would fix it. */
  missing: ("coverage" | "stretch" | "recent-failure" | "retention")[];
  /** Latest solve or revisit on the ladder, or null. */
  lastSolvedAt: string | null;
}

const DAY = 86_400_000;
export const MASTERY_SHARE = 0.8;
export const RECENT_FAILURE_DAYS = 30;
export const RETENTION_GAP_DAYS = 7;
export const REVISE_AFTER_DAYS = 45;

export function masteryOf(
  ladder: LadderItem[],
  statuses: SolveStatus[],
  events: SolveEvent[],
  now: Date = new Date()
): Mastery {
  const slugs = new Set(ladder.map((l) => l.slug.toLowerCase()));
  const solvedSet = new Set(
    statuses.filter((s) => s.status === "solved" && slugs.has(s.problem_slug.toLowerCase())).map((s) => s.problem_slug.toLowerCase())
  );
  const total = ladder.length;
  const need = Math.ceil(total * MASTERY_SHARE);
  const solved = solvedSet.size;

  const hasStretchTier = ladder.some((l) => l.tier === "stretch");
  const stretchSolved = ladder.some((l) => (hasStretchTier ? l.tier === "stretch" : true) && solvedSet.has(l.slug.toLowerCase()));

  const onLadder = events.filter((e) => slugs.has(e.problem_slug.toLowerCase()));
  const recentFailure = onLadder.some(
    (e) => e.kind === "failed" && now.getTime() - Date.parse(e.created_at) <= RECENT_FAILURE_DAYS * DAY
  );

  // Retention: per problem, the first solve (status or event) and any later
  // solve or revisit at least a week after it.
  const solveTimes = new Map<string, number[]>();
  const push = (slug: string, iso: string | null) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return;
    const k = slug.toLowerCase();
    solveTimes.set(k, [...(solveTimes.get(k) ?? []), t]);
  };
  for (const s of statuses) if (s.status === "solved" && slugs.has(s.problem_slug.toLowerCase())) push(s.problem_slug, s.solved_at);
  for (const e of onLadder) if (e.kind === "solved" || e.kind === "revisited") push(e.problem_slug, e.created_at);
  let retained = false;
  let last = -Infinity;
  for (const times of solveTimes.values()) {
    const first = Math.min(...times);
    const latest = Math.max(...times);
    last = Math.max(last, latest);
    if (latest - first >= RETENTION_GAP_DAYS * DAY) retained = true;
  }

  const missing: Mastery["missing"] = [];
  if (solved < need) missing.push("coverage");
  if (!stretchSolved) missing.push("stretch");
  if (recentFailure) missing.push("recent-failure");
  if (!retained) missing.push("retention");

  return {
    solved,
    total,
    need,
    mastered: total > 0 && missing.length === 0,
    missing,
    lastSolvedAt: Number.isFinite(last) ? new Date(last).toISOString() : null,
  };
}

export interface RoadmapEntry {
  slug: string;
  pattern: string;
  blurb: string;
  /** False when no primer exists yet. */
  written: boolean;
  read: boolean;
  /** Stored mastery (sticky) or newly earned. */
  mastered: boolean;
  /** For written primers with a ladder; null otherwise. */
  progress: { solved: number; total: number } | null;
  /**
   * For mastered patterns: "failure" after a fresh failed attempt (it moves back
   * to Read until solved again), "stale" when nothing on the ladder was solved
   * for a while (it stays in Mastered with a nudge). Null otherwise.
   */
  revise: "failure" | "stale" | null;
}

export interface RoadmapGroups {
  upNext: RoadmapEntry[];
  read: RoadmapEntry[];
  mastered: RoadmapEntry[];
}

/**
 * Up next: unread primers in roadmap order, then patterns whose primer isn't
 * written yet. Read: read and not mastered, plus mastered patterns with a
 * fresh failure ("Needs revision"). Mastered: last, stale ones first.
 */
export function groupRoadmap(entries: RoadmapEntry[]): RoadmapGroups {
  const settled = (e: RoadmapEntry) => e.mastered && e.revise !== "failure";
  const mastered = entries.filter(settled);
  const read = entries.filter((e) => !settled(e) && e.written && (e.read || e.mastered));
  const upNext = [
    ...entries.filter((e) => !settled(e) && e.written && !e.read && !e.mastered),
    ...entries.filter((e) => !e.written),
  ];
  return {
    upNext,
    read,
    mastered: [...mastered.filter((e) => e.revise === "stale"), ...mastered.filter((e) => e.revise !== "stale")],
  };
}

/** Why a mastered pattern needs revising, or null. */
export function revisionNeed(m: Mastery, now: Date = new Date()): "failure" | "stale" | null {
  if (m.missing.includes("recent-failure")) return "failure";
  if (!m.lastSolvedAt || now.getTime() - Date.parse(m.lastSolvedAt) > REVISE_AFTER_DAYS * DAY) return "stale";
  return null;
}
