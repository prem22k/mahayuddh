import type { ListProblem, TriState } from "@/types/database";
import { formatDuration } from "./format.ts";
import { squadTodayKey } from "./squadDays.ts";

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
 * Deterministic SOLO Daily Battle selector (Phase 1 Step 6, Bible §6 + §24).
 *
 * Use this only when the viewer has no squad (or a squad of one); squadmates
 * use pickSquadDailyBattle so everyone gets the same problem.
 *
 * Weights (plan Step 6):
 *   low recent exposure    +3   (never attempted in this sheet)
 *   high failure rate      +2   (>=1 recorded fail and not solved)
 *   long gap since revisit +2   (attempted >14 days ago and not solved since)
 *   squad attempted, me no +2
 *   goal pattern           +2
 *   already solved        -10
 *
 * Tiebreak: hash(userId | date | slug), so every solo user gets their own
 * battle while the same user sees the same one all day. `dateStr` defaults to
 * today's IST day key (squadTodayKey), not the UTC date, so the pick changes at
 * midnight IST.
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
  const dateStr = opts.dateStr ?? squadTodayKey();
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

function personalReason(status: TriState | undefined): string | null {
  if (status === "solved") return "You've solved this before. Beat your time.";
  if (status === "attempted") return "You attempted this before. Finish it.";
  return null;
}

/**
 * Deterministic SQUAD Daily Battle selector.
 *
 * Scores only squad-level inputs, so every member computes the identical
 * problem for the same squad/day. The viewer's own statuses and history are
 * read only for the personal "why" line and personal best; they never change
 * the pick.
 *
 * Per unique slug (lowercase; the canonical row is the smallest by list_id,
 * then order_index, then id):
 *   nobody solved it       +3
 *   partly solved          +3 * (1 - solved / memberCount)
 *   goal pattern           +2
 *   tiebreak               + hash(squadId | dayKey | slug) (0..1)
 *
 * Problems solved by every counted member are skipped. If all are skipped,
 * the problem with the fewest solvers (then the same hash) is the rematch.
 */
export function pickSquadDailyBattle(opts: {
  problems: ListProblem[];
  squadId: string;
  dayKey: string;
  memberCount: number;
  solvedBy: Map<string, number>;
  goalPattern?: string | null;
  myStatus?: Record<string, TriState>;
  myHistory?: Map<string, ProblemHistory>;
  squadActivity?: { attempted: number; total: number } | null;
}): DailyPick | null {
  const { problems, squadId, dayKey, solvedBy } = opts;
  if (problems.length === 0) return null;
  const memberCount = Math.max(1, opts.memberCount);
  const goalPattern = (opts.goalPattern ?? "").toLowerCase();
  const myStatus: Record<string, TriState> = opts.myStatus ?? {};
  const myHistory: Map<string, ProblemHistory> =
    opts.myHistory ?? new Map<string, ProblemHistory>();

  // Slugs may repeat across sheets. Keep the smallest row by list_id, then
  // order_index, then id, and sort by the same rule, so the chosen row and the
  // iteration order do not depend on how the list endpoint ordered its rows.
  const preferred = (a: ListProblem, b: ListProblem): number => {
    if (a.list_id !== b.list_id) return a.list_id < b.list_id ? -1 : 1;
    if (a.order_index !== b.order_index) return a.order_index < b.order_index ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  };
  const bySlug = new Map<string, ListProblem>();
  for (const p of problems) {
    const slug = p.title_slug.toLowerCase();
    const kept = bySlug.get(slug);
    if (!kept || preferred(p, kept) < 0) bySlug.set(slug, p);
  }
  const unique = Array.from(bySlug.values()).sort(preferred);

  let best: ListProblem | null = null;
  let bestScore = -Infinity;
  let bestWhy: string[] = [];
  let bestBest: string | null = null;

  for (const p of unique) {
    const slug = p.title_slug.toLowerCase();
    const n = solvedBy.get(slug) ?? 0;
    if (n >= memberCount) continue;

    const why: string[] = [];
    let score = hashSeed(`${squadId}|${dayKey}|${slug}`); // 0..1 tiebreak
    if (n === 0) {
      score += 3;
      why.push(`Fresh for all ${memberCount} of you: nobody had solved it before today.`);
    } else {
      score += 3 * (1 - n / memberCount);
      why.push(`${memberCount - n} of ${memberCount} in your squad hadn't solved it before today.`);
    }

    if (goalPattern && p.category.toLowerCase().includes(goalPattern)) {
      score += 2;
      why.push(`Matches your squad goal pattern: ${p.category}.`);
    }

    const personal = personalReason(myStatus[slug]);
    const combinedWhy = personal ? [personal, ...why] : why;
    const hist = myHistory.get(slug);

    if (score > bestScore) {
      bestScore = score;
      best = p;
      bestWhy = combinedWhy.slice(0, 3);
      bestBest = hist?.bestSec != null ? formatDuration(hist.bestSec) : null;
    }
  }

  if (!best) {
    // Everyone has solved everything. Pick the least-solved problem so the
    // rematch is at least the one the squad has practised least.
    let fallback: ListProblem | null = null;
    let fallbackSolved = Infinity;
    let fallbackHash = -Infinity;
    for (const p of unique) {
      const slug = p.title_slug.toLowerCase();
      const n = solvedBy.get(slug) ?? 0;
      const h = hashSeed(`${squadId}|${dayKey}|${slug}`);
      if (n < fallbackSolved || (n === fallbackSolved && h > fallbackHash)) {
        fallback = p;
        fallbackSolved = n;
        fallbackHash = h;
      }
    }
    if (!fallback) return null;
    const slug = fallback.title_slug.toLowerCase();
    const personal = personalReason(myStatus[slug]);
    const hist = myHistory.get(slug);
    return {
      problem: fallback,
      why: [...(personal ? [personal] : []), "Your squad has solved every problem here. Rematch."].slice(
        0,
        3
      ),
      squadContext: opts.squadActivity ?? null,
      personalBest: hist?.bestSec != null ? formatDuration(hist.bestSec) : null,
    };
  }

  return {
    problem: best,
    why: bestWhy,
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