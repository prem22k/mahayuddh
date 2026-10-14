import type { Battle, BattleOutcome, Problem, ProblemEvent, Approach, Suggestion } from "@/types/database";
import { formatDuration, titleFromSlug } from "./format.ts";

// Re-exported so existing call sites keep one import path.
export { formatDuration, titleFromSlug };

/**
 * BATTLE CARD (Step 16, Bible §7/§38/§39/§48).
 *
 * A projection, never a table (§63). Everything here is derived from rows that
 * already exist: `battles`, `problem_events`, `approaches`, `suggestions`.
 * If a number is not derivable it is null — never estimated.
 *
 * The privacy split is the important part. A card is the *shareable* artifact,
 * so `buildPublicCard` emits only what a stranger may see. The full card
 * (approach excerpt, squad name) is for the owner and squad members.
 * `scratchpad_md` never leaves the database for a card, at any visibility:
 * the scratchpad is the "During" object and is private by design (§15).
 */

export interface BattleCardStats {
  /** Total recorded sessions for this problem, any outcome. */
  attempts: number;
  /** How many times this was solved again after a previous solve. */
  revisits: number;
  /** Challenges the owner sent for this problem. */
  challengesSent: number;
  /** Challenges from squad members that the owner completed. */
  friendsCompleted: number;
}

export interface BattleCardCore {
  battleId: string;
  problemSlug: string;
  title: string;
  difficulty: string | null;
  /** First catalog topic, or null when the catalog has no record. */
  pattern: string | null;
  /** This solve's duration, or null when the battle was not timed. */
  solvedSec: number | null;
  /** Fastest earlier solve, or null on a first solve. */
  previousBestSec: number | null;
  /** True when a previous solve exists and this one beat it. */
  isPersonalRecord: boolean;
  outcome: BattleOutcome;
  evidence: "leetcode" | "none";
  confidence: number | null;
  startedAt: string;
  endedAt: string | null;
  stats: BattleCardStats;
}

export interface BattleCardFull extends BattleCardCore {
  ownerId: string;
  ownerUsername: string | null;
  squadId: string | null;
  squadName: string | null;
  /** Owner/squad's own approach, truncated. Only ever set for a permitted viewer. */
  approachExcerpt: string | null;
  approachId: string | null;
}

/** What a logged-out visitor sees on /b/[id]. */
export interface BattleCardPublic {
  battleId: string;
  problemSlug: string;
  title: string;
  difficulty: string | null;
  pattern: string | null;
  solvedSec: number | null;
  previousBestSec: number | null;
  isPersonalRecord: boolean;
  evidence: "leetcode" | "none";
  ownerUsername: string | null;
  startedAt: string;
  stats: BattleCardStats;
  /** True when the owner has a squad/public approach, without exposing its text. */
  hasSharedApproach: boolean;
  /**
   * The public approach to link to (/a/[id]), or null when there is none.
   * Squad-only approaches keep hasSharedApproach true but link nowhere public:
   * the card points at the artifact without reproducing it, and a squad-only
   * row must never get a public URL.
   */
  sharedApproachId: string | null;
}

/** Raw rows the projection reads. Kept structural so tests need no Supabase. */
export interface BattleCardInput {
  battle: Battle;
  ownerUsername: string | null;
  squadName: string | null;
  problem: Problem | null;
  allBattles: Battle[];
  events: ProblemEvent[];
  approaches: Approach[];
  challenges: Suggestion[];
}

/**
 * Personal best *before* this battle. Counting the current solve in its own
 * baseline would make every solve a non-record, which is how a card quietly
 * stops meaning anything.
 */
export function previousBestSec(
  battle: Battle,
  allBattles: Battle[]
): { previousBestSec: number | null; isPersonalRecord: boolean } {
  const isSolved = battle.outcome === "solved" && battle.duration_sec != null;
  if (!isSolved) return { previousBestSec: null, isPersonalRecord: false };

  const earlierSolves = allBattles
    .filter(
      (b) =>
        b.id !== battle.id &&
        b.outcome === "solved" &&
        b.duration_sec != null &&
        new Date(b.started_at).getTime() < new Date(battle.started_at).getTime()
    )
    .map((b) => b.duration_sec as number);

  if (earlierSolves.length === 0) {
    // First timed solve. Honest framing: there was nothing to beat.
    return { previousBestSec: null, isPersonalRecord: false };
  }

  const previousBest = Math.min(...earlierSolves);
  const isRecord = (battle.duration_sec as number) < previousBest;
  return { previousBestSec: previousBest, isPersonalRecord: isRecord };
}

function buildStats(input: BattleCardInput): BattleCardStats {
  const slug = input.battle.problem_slug.toLowerCase();

  const attempts = input.allBattles.length;
  const revisits = input.events.filter(
    (e) => e.problem_slug.toLowerCase() === slug && e.kind === "revisited"
  ).length;
  const challengesSent = input.challenges.filter(
    (c) => c.from_user === input.battle.user_id
  ).length;
  const friendsCompleted = input.challenges.filter(
    (c) => c.to_user === input.battle.user_id && c.status === "completed"
  ).length;

  return { attempts, revisits, challengesSent, friendsCompleted };
}

/** Full card for the owner and squad members. */
export function buildBattleCard(input: BattleCardInput): BattleCardFull {
  const { battle } = input;
  const slug = battle.problem_slug.toLowerCase();
  const { previousBestSec: prev, isPersonalRecord } = previousBestSec(battle, input.allBattles);

  const ownApproach =
    input.approaches.find((a) => a.user_id === battle.user_id && a.problem_slug.toLowerCase() === slug) ??
    null;

  return {
    battleId: battle.id,
    problemSlug: slug,
    title: input.problem?.title ?? titleFromSlug(slug),
    difficulty: input.problem?.difficulty ?? null,
    // First topic is the best single label available; the sheet's category is
    // a squad-local grouping, not a taxonomy.
    pattern: input.problem?.topics?.[0] ?? null,
    solvedSec: battle.outcome === "solved" ? battle.duration_sec : null,
    previousBestSec: prev,
    isPersonalRecord,
    outcome: battle.outcome,
    evidence: battle.evidence,
    confidence: battle.confidence,
    startedAt: battle.started_at,
    endedAt: battle.ended_at,
    stats: buildStats(input),
    ownerId: battle.user_id,
    ownerUsername: input.ownerUsername,
    squadId: battle.squad_id,
    squadName: input.squadName,
    approachExcerpt: ownApproach ? excerpt(ownApproach.core_idea) : null,
    approachId: ownApproach?.id ?? null,
  };
}

/**
 * Public projection for /b/[id]. Drops squad identity and the approach text.
 *
 * An approach excerpt is withheld even when public: a share card should point
 * at the artifact, not reproduce it. `hasSharedApproach` tells the viewer
 * there is something to look at without leaking it here.
 */
export function buildPublicCard(input: BattleCardInput): BattleCardPublic {
  const full = buildBattleCard(input);
  const slug = full.problemSlug;
  const shareableApproach = input.approaches.some(
    (a) =>
      a.user_id === full.ownerId &&
      a.problem_slug.toLowerCase() === slug &&
      (a.visibility === "public" || a.visibility === "squad")
  );
  // Only a visibility=public row gets a public URL. A squad-only approach is
  // still counted above (the viewer learns something exists) but never linked.
  const publicApproach =
    input.approaches.find(
      (a) =>
        a.user_id === full.ownerId &&
        a.problem_slug.toLowerCase() === slug &&
        a.visibility === "public"
    ) ?? null;

  return {
    battleId: full.battleId,
    problemSlug: full.problemSlug,
    title: full.title,
    difficulty: full.difficulty,
    pattern: full.pattern,
    solvedSec: full.solvedSec,
    previousBestSec: full.previousBestSec,
    isPersonalRecord: full.isPersonalRecord,
    evidence: full.evidence,
    ownerUsername: full.ownerUsername,
    startedAt: full.startedAt,
    stats: full.stats,
    hasSharedApproach: shareableApproach,
    sharedApproachId: publicApproach?.id ?? null,
  };
}

function excerpt(text: string, max = 180): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

