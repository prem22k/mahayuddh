import type { Suggestion, ChainState } from "@/types/database";

/**
 * Challenge chains (Step 17, Bible §10/§11).
 *
 * A chain is the pass-along lineage of a challenge: Prem → Rahul → Arjun. It is
 * derived from `suggestions.parent_id` — no chain table, because the parent
 * link IS the chain (§63).
 *
 * Four states, because "pending" alone hides the difference between a challenge
 * somebody is working on and one that quietly died:
 *   active     — pending, inside its deadline
 *   completed  — somebody finished it
 *   broken     — dismissed, or the holder declined it
 *   timed_out  — still pending, but past its deadline
 */

const DEAD_STATUSES = new Set(["dismissed"]);

export function chainState(
  challenge: Pick<Suggestion, "status" | "deadline_at">,
  now: Date = new Date()
): ChainState {
  if (challenge.status === "completed") return "completed";
  if (DEAD_STATUSES.has(challenge.status)) return "broken";
  // A passed challenge that reached a recipient but was never answered is the
  // other half of "broken": the lineage advanced without anyone solving.
  if (challenge.status === "pending" && challenge.deadline_at) {
    if (new Date(challenge.deadline_at).getTime() < now.getTime()) return "timed_out";
  }
  return "active";
}

export const CHAIN_STATE_LABEL: Record<ChainState, string> = {
  active: "active",
  completed: "completed",
  broken: "broken",
  timed_out: "timed out",
};

export const CHAIN_STATE_CLASS: Record<ChainState, string> = {
  active: "bg-surface-overlay border-hairline-strong text-text-secondary",
  completed: "bg-verified/15 border-verified/30 text-verified",
  broken: "bg-surface border-hairline text-text-disabled line-through",
  timed_out: "bg-primary/15 border-primary/30 text-primary",
};

/** A challenge with only itself as its parent. */
export function isChainRoot(c: Pick<Suggestion, "parent_id">): boolean {
  return c.parent_id == null;
}

/**
 * How many people have held this challenge, counting the leaf.
 *
 * Prem → Rahul → Arjun is 3, not 2: the number that matters socially is how
 * far the problem travelled, which is what "longest chain" means to a squad.
 *
 * Bounded at 10 so a cycle from bad data cannot hang a render — the caller gets
 * a truncated count rather than a hang.
 */
export function chainHops(rows: Pick<Suggestion, "id" | "parent_id">[], leafId: string): number {
  const byId = new Map(rows.map((r) => [r.id, r.parent_id]));
  let hops = 1;
  let current = byId.get(leafId) ?? null;
  const seen = new Set<string>([leafId]);
  while (current && hops < 10) {
    if (seen.has(current)) break;
    seen.add(current);
    hops += 1;
    current = byId.get(current) ?? null;
  }
  return hops;
}

export interface ActiveChainSummary {
  leafId: string;
  problemSlug: string;
  problemTitle: string;
  hops: number;
  members: string[];
}

/**
 * The longest active chain in a set of rows — the squad's "Challenge Chain —
 * LRU Cache" highlight (Step 17). Null when nothing is active, so callers can
 * skip the section instead of rendering an empty header.
 */
export function longestActiveChain(
  rows: Pick<Suggestion, "id" | "parent_id" | "problem_slug" | "problem_title" | "status" | "deadline_at">[],
  now: Date = new Date()
): ActiveChainSummary | null {
  if (rows.length === 0) return null;

  const byId = new Map(rows.map((r) => [r.id, r]));
  let best: ActiveChainSummary | null = null;

  for (const row of rows) {
    // Only leaves can be "the" chain; an interior node would double-count.
    const hasChild = rows.some((r) => r.parent_id === row.id);
    if (hasChild) continue;
    if (chainState(row, now) !== "active") continue;

    const hops = chainHops(rows, row.id);
    if (best && hops <= best.hops) continue;

    // Walk back to the root for a display order oldest-first.
    const members: string[] = [];
    let current: Pick<Suggestion, "id" | "parent_id"> | undefined = row;
    const seen = new Set<string>();
    while (current && !seen.has(current.id) && members.length < 10) {
      seen.add(current.id);
      members.unshift(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    best = {
      leafId: row.id,
      problemSlug: row.problem_slug,
      problemTitle: row.problem_title,
      hops,
      members,
    };
  }

  return best;
}

/** Chain rows oldest-first for rendering Prem → Rahul → Arjun. */
export function orderChainOldestFirst<T extends Pick<Suggestion, "id" | "parent_id">>(
  rows: T[],
  leafId: string
): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  let current: Pick<Suggestion, "id" | "parent_id"> | undefined = byId.get(leafId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id) && out.length < 10) {
    seen.add(current.id);
    const row = byId.get(current.id);
    if (!row) break;
    out.unshift(row as T);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return out;
}