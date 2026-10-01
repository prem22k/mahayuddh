import type { ListProblem, TriState } from "@/types/database";
import { formatDuration } from "./format.ts";

export { formatDuration };

export interface DailyPick {
  problem: ListProblem;
  /** Truthful, data-backed reasons. Never hallucinated stats. */
  why: string[];
  /** null = solo. Never label global profiles as "your squad". */
  squadContext: { attempted: number; total: number } | null;
  /** Fastest completed solve, formatted. null when never solved. */
  personalBest: string | null;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Deterministic Daily Battle selector (Phase 1 Step 6, Bible §6 + §24).
 *
 * Weights (plan Step 6):
 *   low recent exposure    +3   (never attempted in this sheet)
 *   high failure rate      +2   (>=1 recorded fail and not solved)
 *   long gap since revisit +2   (attempted >14 days ago and not solved since)
 *   squad attempted, me no +2
 *   goal pattern           +2
 *   already solved        -10
 *
 * Tiebreak: hash(userId | date | slug), so every user gets a different battle
 * while the same user sees the same one all day.
 */
export function pickDailyBattle(opts: {
  problems: ListProblem[];
  statusMap: Record<string, TriState>;
  userId?: string | null;
  dateStr?: string;
  squadSlugs?: Set<string>;
  goalPattern?: string | null;
  /** userId -> { failures, lastTouchedAt, bestSec } from problem_events. */
  history?: Map<string, ProblemHistory>;
  squadActivity?: { attempted: number; total: number } | null;
}): DailyPick | null {
  const { problems, statusMap } = opts;
  if (problems.length === 0) return null;
  const dateStr = opts.dateStr ?? new Date().toISOString().slice(0, 10);
  const userId = opts.userId ?? "anon";
  const squadSlugs = opts.squadSlugs ?? new Set<string>();
  const goalPattern = (opts.goalPattern ?? "").toLowerCase();
  const history = opts.history ?? new Map<string, ProblemHistory>();
  const GAP_DAYS = 14;

  let best: ListProblem | null = null;
  let bestScore = -Infinity;
  let bestWhy: string[] = [];
  let bestBest: string | null = null;

  for (const p of problems) {
    const slug = p.title_slug.toLowerCase();
    const st = statusMap[slug];
    const hist = history.get(slug);
    const why: string[] = [];
    let score = hashSeed(`${userId}|${dateStr}|${slug}`); // 0..1 tiebreak

    if (st === "solved") {
      score -= 10;
    } else if (st === "attempted") {
      // Retry value (+2) plus explicit failure/gap bonuses below.
      score += 2;
      why.push("You attempted this before — finish it.");
    } else {
      score += 3;
      why.push("Unsolved in your sheets.");
    }

    // High failure rate: honest only when we actually recorded failures.
    if (st !== "solved" && hist && hist.failures > 0) {
      score += 2;
      why.push(`${hist.failures} failed ${hist.failures === 1 ? "attempt" : "attempts"} on record.`);
    }

    // Long gap since last touch.
    if (st !== "solved" && hist && hist.lastTouchedAt) {
      const days = Math.floor((Date.now() - hist.lastTouchedAt) / 86_400_000);
      if (days >= GAP_DAYS) {
        score += 2;
        why.push(`Last touched ${days} days ago.`);
      }
    }

    if (squadSlugs.has(slug) && st !== "solved") {
      score += 2;
      why.push("Your squad is already on this one.");
    }

    if (goalPattern && p.category.toLowerCase().includes(goalPattern)) {
      score += 2;
      why.push(`Matches your squad goal pattern: ${p.category}.`);
    }

    if (score > bestScore) {
      bestScore = score;
      best = p;
      bestWhy = why.slice(0, 3);
      bestBest = hist?.bestSec != null ? formatDuration(hist.bestSec) : null;
    }
  }

  if (!best) return null;
  return {
    problem: best,
    why: bestWhy,
    // Pass through only a real squad measurement; never infer one.
    squadContext: opts.squadActivity ?? null,
    personalBest: bestBest,
  };
}

export interface ProblemHistory {
  failures: number;
  revisits: number;
  lastTouchedAt: number | null;
  bestSec: number | null;
}

/** Slugs with any squad-member status (for the "squad is on this" signal). */
export function toSquadSlugSet(
  rows: { problem_slug: string; user_id?: string }[],
  excludeUserId?: string
): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    if (excludeUserId && r.user_id === excludeUserId) continue;
    set.add(r.problem_slug.toLowerCase());
  }
  return set;
}