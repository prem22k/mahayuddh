import type { StuckLevel, StuckVisibility } from "@/types/database";

/**
 * The I'm Stuck ladder (Step 18, Bible §12).
 *
 * Product rule: least help to continue thinking, not fastest answer. The
 * ordering is the whole idea — a nudge you can act on beats an answer that
 * teaches nothing. This module holds the vocabulary and the copy; the database
 * enforces the ordering separately (a reply may not exceed the requested level).
 */

export const STUCK_LEVELS: readonly StuckLevel[] = [
  "nudge",
  "pattern",
  "direction",
  "full",
] as const;

export const LEVEL_RANK: Record<StuckLevel, number> = {
  nudge: 1,
  pattern: 2,
  direction: 3,
  full: 4,
};

export const LEVEL_LABEL: Record<StuckLevel, string> = {
  nudge: "Nudge",
  pattern: "Pattern hint",
  direction: "Direction",
  full: "Full explanation",
};

/** What the asker actually gets at each level, stated plainly. */
export const LEVEL_PROMISE: Record<StuckLevel, string> = {
  nudge: "One small observation. Enough to unstick you, not enough to solve it.",
  pattern: "Which pattern this is, and the question that pattern answers.",
  direction: "The shape of a working solution. Not the solution.",
  full: "A complete walkthrough. You are accepting the spoiler.",
};

/**
 * Copy that teaches, and a nudge is worth offering only as a nudge.
 * Deliberately not solution-shaped: the ladder exists to preserve thinking.
 */
export const LEVEL_EXAMPLE: Record<StuckLevel, string> = {
  nudge: "What property stays true as you scan?",
  pattern: "This is a two-pointers problem — which end can you discard safely?",
  direction: "Try building the result backwards while walking the input once.",
  full: "Walk through the code, then close this and re-solve from scratch within 48 hours.",
};

export const LEVEL_CLASS: Record<StuckLevel, string> = {
  nudge: "bg-[#30d158]/15 border-[#30d158]/30 text-[#30d158]",
  pattern: "bg-[#0a84ff]/15 border-[#0a84ff]/30 text-[#0a84ff]",
  direction: "bg-[#ff9f0a]/15 border-[#ff9f0a]/30 text-[#ff9f0a]",
  full: "bg-[#bf5af2]/15 border-[#bf5af2]/30 text-[#bf5af2]",
};

/** Levels a helper may pick when answering a request for `asked`. */
export function allowedReplyLevels(asked: StuckLevel): StuckLevel[] {
  return STUCK_LEVELS.filter((l) => LEVEL_RANK[l] <= LEVEL_RANK[asked]);
}

/** True when the ladder jumped to the top level — worth counting separately. */
export function isSpoilerLevel(level: StuckLevel): boolean {
  return level === "full";
}

export const VISIBILITY_LABEL: Record<StuckVisibility, string> = {
  squad: "My squad",
  public: "Anyone on Mahayuddh",
  anon: "Anonymous — nobody sees who is stuck",
};

/**
 * How stuck does this feel? A rough self-report that maps to the level you
 * should ask for. Not a score, just a way to pick the smallest useful ask.
 */
export function suggestLevel(attempts: number, hasScratchpad: boolean): StuckLevel {
  if (attempts >= 3 && hasScratchpad) return "direction";
  if (attempts >= 2) return "pattern";
  return "nudge";
}