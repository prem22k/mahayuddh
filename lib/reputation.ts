/**
 * Reputation dimensions (Step 22, Bible §22).
 *
 * §22: "Do not compress these immediately into a single 'skill score.' A single
 * score creates false precision and invites gaming."
 *
 * That is enforced in three places, deliberately:
 *
 *  1. The database view has no total column. Checked in
 *     tests/integration/teacherStats.mjs against information_schema, not a comment.
 *  2. This module exposes no function that returns a single number. There is no
 *     `reputationScore()` to reach for.
 *  3. Every dimension carries its own definition, because a number with no
 *     definition invites somebody to optimise the number instead of the thing.
 *
 * What this module deliberately does NOT do: rank people, sort by a blend, or
 * badge anybody. §22 is a list of dimensions, not a ladder.
 */

/** The raw columns public.teacher_stats exposes. One count per dimension. */
export interface TeacherStats {
  user_id: string;
  username: string;
  logged_solves: number;
  verified_solves: number;
  active_days: number;
  battles: number;
  battles_won: number;
  approaches: number;
  patterns_taught: number;
  primers: number;
  challenge_completions: number;
  challenges_sent: number;
  discussions: number;
  replies_received: number;
  note_forks: number;
  primer_forks: number;
  frequent_patterns: string[];
  improvements: number;
}

export interface Dimension {
  /** The §22 dimension name. */
  id: "solving" | "teaching" | "helpfulness" | "consistency" | "impact";
  label: string;
  /** What this number actually counts. Shown, so the number means something. */
  definition: string;
  value: number;
  /** Optional second line: context that stops a raw count being misread. */
  note?: string;
}

/**
 * The five dimensions §22 names, each with the specific counts behind it.
 *
 * Order is §22's order and is not sorted by value: a person who teaches a lot
 * and solves a little should not have their teaching hidden under a bigger
 * number in a different row.
 */
export function reputationDimensions(s: TeacherStats): Dimension[] {
  return [
    {
      id: "solving",
      label: "Problem solving",
      definition: "Solves logged, with the verified ones counted apart.",
      value: s.verified_solves,
      note:
        s.logged_solves > s.verified_solves
          ? `${s.logged_solves} logged, ${s.verified_solves} with LeetCode evidence.`
          : `${s.logged_solves} logged, all with LeetCode evidence.`,
    },
    {
      id: "teaching",
      label: "Teaching",
      definition: "Public approaches and primers other people can use.",
      value: s.approaches + s.primers,
      note:
        s.primers > 0
          ? `${s.approaches} approaches, ${s.primers} primers, ${s.patterns_taught} patterns.`
          : `${s.approaches} ${s.approaches === 1 ? "approach" : "approaches"}.`,
    },
    {
      id: "helpfulness",
      label: "Helpfulness",
      definition: "Challenges that got finished, and discussion people stayed with.",
      value: s.challenge_completions + s.replies_received,
      note: `${s.challenge_completions} of ${s.challenges_sent} challenges completed, ${s.discussions} discussions.`,
    },
    {
      id: "consistency",
      label: "Consistency",
      definition: "Days with real logged activity, and sessions actually started.",
      value: s.active_days,
      note: `${s.active_days} active ${s.active_days === 1 ? "day" : "days"}, ${s.battles} sessions.`,
    },
    {
      id: "impact",
      label: "Impact",
      definition: "Times somebody forked their writing, and problems they got faster at.",
      value: s.note_forks + s.primer_forks + s.improvements,
      note: `${s.note_forks + s.primer_forks} forks, ${s.improvements} ${s.improvements === 1 ? "problem" : "problems"} improved on.`,
    },
  ];
}

/**
 * "Often teaches: Graphs · DP · Sliding Window" (§22 UI).
 *
 * Capped at three. A list of eleven patterns is not a summary, and the cap is
 * applied by rank of frequency so the ones shown are the ones that recur.
 */
export function oftenTeaches(patterns: string[], limit = 3): string[] {
  return patterns.slice(0, limit);
}

/**
 * Deliberately returns nothing.
 *
 * §22 forbids a single score. There is no function here that combines the
 * dimensions, and this stub exists so that the ban has an obvious place to be
 * re-litigated: if somebody needs a number, they have to delete this and write
 * the reasoning down, rather than discovering that one already existed.
 */
export const NO_SINGLE_REPUTATION_SCORE = {
  allowed: false,
  reason:
    "§22: a single score creates false precision and invites gaming. Show the dimensions.",
} as const;