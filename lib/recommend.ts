/**
 * Recommendation engine (Step 24, Bible §24).
 *
 * "Next battle: Number of Islands — Why: Graph low, 12 days gap, prerequisite
 * done."
 *
 * The only hard requirement is that every bullet is TRUE. §24's done criterion
 * is "4/5 recommendations have ≥2 truthful why-bullets", and a recommendation
 * with invented reasons is worse than no recommendation: it teaches people to
 * click without reading, and then the reason never mattered.
 *
 * So each signal here returns its bullet or nothing. There is no filler, no
 * "recommended for you", and no default reason. A problem with one real reason
 * gets one bullet, and the caller is told that is all there is.
 *
 * Deterministic and hand-weighted. §24's "NOT building: ML model, black-box
 * score" is a constraint, not a phase-1 excuse — a black box cannot be argued
 * with, and this engine's weights are in this file.
 */

import { canonicalPattern, prereqStatus, type PrereqVerdict } from "./patternPrereqs.ts";
import { formatDuration } from "./format.ts";

export type SignalId =
  | "low_exposure"
  | "high_failure"
  | "long_gap"
  | "prereq_ready"
  | "prereq_missing"
  | "plateau"
  | "squad_activity"
  | "goal";

export interface RecommendationSignal {
  id: SignalId;
  /** What the measurement was. Shown so the bullet can be checked. */
  bullet: string;
  /** Contribution to rank. Kept visible for tests, never shown as a number. */
  weight: number;
}

export interface RecommendationCandidate {
  titleSlug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  /** Any pattern name this problem carries — topic or sheet category. */
  patterns: string[];
}

export interface PatternSignal {
  pattern: string;
  attempted: number;
  solved: number;
  failed: number;
  /** Epoch ms of the most recent event, or null. */
  lastTouchedAt: number | null;
}

/** Per-problem history, built from problem_events. */
export interface ProblemSignal {
  slug: string;
  attempts: number;
  failures: number;
  solves: number;
  /** Best and most recent solve durations, for plateau detection. */
  durations: number[];
  lastTouchedAt: number | null;
}

export interface RecommendInput {
  candidates: RecommendationCandidate[];
  /** pattern -> aggregate signal for the caller. */
  patterns: Map<string, PatternSignal>;
  /** slug -> per-problem signal. */
  problems: Map<string, ProblemSignal>;
  /** Squad goal pattern, if the caller set one. */
  goalPattern?: string | null;
  /** Slugs at least one squad-mate has attempted and the caller has not. */
  squadAttempted?: Set<string>;
  now?: number;
}

export interface Recommendation {
  problem: RecommendationCandidate;
  /** The headline. Never padded: an empty list means we had nothing to say. */
  why: string[];
  signals: RecommendationSignal[];
  /**
   * How many reasons we actually had. The UI shows this rather than hiding a
   * one-bullet recommendation — a thin reason should look thin.
   */
  reasonCount: number;
  /** Set when prerequisites are not met: we are suggesting this too early. */
  blockedBy: string[];
}

export interface RecommendOptions {
  /** A recommendation needs at least this many real bullets to be offered. */
  minBullets?: number;
  /** Days since last touch before "long gap" applies. */
  gapDays?: number;
  /** Attempts on one problem before "plateau" is worth saying. */
  plateauAttempts?: number;
}

const DEFAULTS: Required<RecommendOptions> = {
  minBullets: 1,
  gapDays: 14,
  plateauAttempts: 3,
};

export const GAP_DAYS = DEFAULTS.gapDays;
export const PLATEAU_ATTEMPTS = DEFAULTS.plateauAttempts;

/** Summed across the problem's patterns, so multi-pattern problems can win. */
function patternSignalFor(
  cand: RecommendationCandidate,
  patterns: Map<string, PatternSignal>
): PatternSignal | null {
  let attempted = 0;
  let solved = 0;
  let failed = 0;
  let lastTouchedAt: number | null = null;
  let seen = false;

  for (const raw of cand.patterns) {
    const s = patterns.get(canonicalPattern(raw));
    if (!s) continue;
    seen = true;
    attempted += s.attempted;
    solved += s.solved;
    failed += s.failed;
    if (s.lastTouchedAt && (lastTouchedAt === null || s.lastTouchedAt > lastTouchedAt)) {
      lastTouchedAt = s.lastTouchedAt;
    }
  }
  if (!seen) return null;
  return { pattern: cand.patterns[0] ?? "", attempted, solved, failed, lastTouchedAt };
}

/**
 * Plateau detection.
 *
 * A plateau is ≥3 attempts on one problem with recorded solve times that are
 * not getting better. Deliberately narrow: it needs at least two timed solves,
 * because without two measurements there is nothing to be flat about, and
 * "you have failed this 5 times" is a failure count, not a plateau.
 */
export function isPlateau(sig: ProblemSignal | undefined, opts = DEFAULTS): boolean {
  if (!sig) return false;
  if (sig.attempts < opts.plateauAttempts) return false;
  if (sig.durations.length < 2) return false;
  const first = sig.durations[0];
  const last = sig.durations[sig.durations.length - 1];
  // Not improving: the most recent is no better than the first.
  return last >= first;
}

/**
 * Rank candidates and return the best one that has at least minBullets honest
 * reasons. Null when nothing qualifies — which is a valid answer and the UI
 * says so rather than dressing up a random problem.
 */
export function recommendNextBattle(
  input: RecommendInput,
  options: RecommendOptions = {}
): Recommendation | null {
  const opts = { ...DEFAULTS, ...options };
  const now = input.now ?? Date.now();

  // Exposure per canonical pattern, for the prerequisite check. Derived from
  // the same pattern signals rather than a second source, so the prereq claim
  // and the low-exposure bullet cannot disagree.
  const exposure = new Map<string, number>();
  for (const [name, s] of input.patterns) exposure.set(name, s.attempted + s.solved);

  let best: Recommendation | null = null;
  let bestScore = -Infinity;

  for (const cand of input.candidates) {
    const slug = cand.titleSlug.toLowerCase();
    const sig = patternSignalFor(cand, input.patterns);
    const prob = input.problems.get(slug);
    const signals: RecommendationSignal[] = [];

    if (sig && sig.solved === 0 && sig.attempted < 3) {
      signals.push({
        id: "low_exposure",
        bullet: `${patternLabel(cand)} low — ${sig.attempted} logged so far.`,
        weight: 3,
      });
    }

    if (sig && sig.failed > 0 && sig.solved === 0) {
      signals.push({
        id: "high_failure",
        bullet: `${sig.failed} failed ${sig.failed === 1 ? "attempt" : "attempts"} here.`,
        weight: 3,
      });
    }

    if (sig && sig.solved === 0 && sig.lastTouchedAt) {
      const days = Math.floor((now - sig.lastTouchedAt) / 86_400_000);
      if (days >= opts.gapDays) {
        signals.push({
          id: "long_gap",
          bullet: `${days} days since you touched ${patternLabel(cand)}.`,
          weight: 2,
        });
      }
    }

    // Prerequisites: the strongest bullet when it fires, because it is the one
    // that explains WHY this problem rather than that it is overdue.
    const primary = cand.patterns[0];
    const verdict: PrereqVerdict | null = primary ? prereqStatus(primary, exposure) : null;
    if (verdict && verdict.met.length > 0) {
      signals.push({
        id: "prereq_ready",
        bullet: `prereq met: ${verdict.met.join(", ")}.`,
        weight: 3,
      });
    }
    if (verdict && verdict.unmet.length > 0) {
      signals.push({
        id: "prereq_missing",
        bullet: `prereq not met: ${verdict.unmet.join(", ")}.`,
        weight: -4,
      });
    }

    if (isPlateau(prob, opts)) {
      const first = prob!.durations[0];
      const last = prob!.durations[prob!.durations.length - 1];
      signals.push({
        id: "plateau",
        bullet:
          last >= first
            ? `${prob!.attempts} attempts, best ${formatDuration(Math.min(...prob!.durations))}, last ${formatDuration(last)} — not getting faster.`
            : `${prob!.attempts} attempts on this one.`,
        weight: 4,
      });
    }

    if (input.squadAttempted?.has(slug) && !prob?.solves) {
      signals.push({
        id: "squad_activity",
        bullet: "your squad has already started this one.",
        weight: 2,
      });
    }

    if (
      input.goalPattern &&
      cand.patterns.some((p) => canonicalPattern(p) === canonicalPattern(input.goalPattern!))
    ) {
      signals.push({
        id: "goal",
        bullet: `matches your goal: ${input.goalPattern}.`,
        weight: 2,
      });
    }

    if (signals.length < opts.minBullets) continue;

    const score = signals.reduce((sum, s) => sum + s.weight, 0);
    // Tiebreak is a hash of the slug, so the same inputs give the same answer
    // and two equally-scored problems do not flip on every render.
    const tie = hash01(slug) * 0.01;

    if (score + tie > bestScore) {
      bestScore = score + tie;
      best = {
        problem: cand,
        // Strongest reason first: the bullet that explains the choice should not
        // be buried under a gap that would have applied to anything.
        why: [...signals]
          .sort((a, b) => b.weight - a.weight)
          .map((s) => s.bullet),
        signals,
        reasonCount: signals.length,
        blockedBy: verdict?.unmet ?? [],
      };
    }
  }

  return best;
}

function patternLabel(cand: RecommendationCandidate): string {
  const p = canonicalPattern(cand.patterns[0] ?? "");
  return p || "This pattern";
}

/** Deterministic 0..1 from a string. Same input, same output, always. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16779519);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Headline string, matching §24's shape:
 * "Next battle: Number of Islands — Why: Graph low, 12 days gap, prerequisite done".
 */
export function recommendationHeadline(rec: Recommendation): string {
  const why = rec.why.length > 0 ? rec.why.join(" · ") : "no recorded reason";
  return `Next battle: ${rec.problem.title} — Why: ${why}`;
}

/**
 * Build pattern and problem signals from raw problem_events rows.
 *
 * Kept here rather than in the data layer so the aggregation rules (what counts
 * as an attempt, how durations are ordered) are testable without a database.
 */
export function buildSignalsFromEvents(
  events: {
    problem_slug: string;
    kind: string;
    created_at: string;
    duration_sec: number | null;
    patternsBySlug: Map<string, string[]>;
  }[]
): { patterns: Map<string, PatternSignal>; problems: Map<string, ProblemSignal> } {
  const problems = new Map<string, ProblemSignal>();
  const patterns = new Map<string, PatternSignal>();

  const ordered = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const e of ordered) {
    const slug = e.problem_slug.toLowerCase();
    const at = new Date(e.created_at).getTime();

    let p = problems.get(slug);
    if (!p) {
      p = { slug, attempts: 0, failures: 0, solves: 0, durations: [], lastTouchedAt: null };
      problems.set(slug, p);
    }

    if (e.kind === "solved" || e.kind === "revisited") {
      p.solves += 1;
      p.attempts += 1;
      if (e.duration_sec != null) p.durations.push(e.duration_sec);
    } else if (e.kind === "failed") {
      p.failures += 1;
      p.attempts += 1;
    }
    if (e.kind !== "explained") p.lastTouchedAt = at;

    for (const raw of e.patternsBySlug.get(slug) ?? []) {
      const name = canonicalPattern(raw);
      let s = patterns.get(name);
      if (!s) {
        s = { pattern: name, attempted: 0, solved: 0, failed: 0, lastTouchedAt: null };
        patterns.set(name, s);
      }
      if (e.kind === "solved" || e.kind === "revisited") s.solved += 1;
      else if (e.kind === "failed") s.failed += 1;
      if (e.kind !== "explained") {
        s.attempted += 1;
        if (s.lastTouchedAt === null || at > s.lastTouchedAt) s.lastTouchedAt = at;
      }
    }
  }

  return { patterns, problems };
}