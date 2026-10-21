import type { Approach } from "@/types/database";
import type { SolveProof } from "@/components/approach/solveProof";

/**
 * Shapes the public portfolio passes between its server page and client tabs.
 * Everything here is already public: catalog rows, and the same per-approach
 * solve proof /a/[id] shows beside a public approach.
 */

/** Catalog facts for one problem slug. */
export interface ProblemMeta {
  title: string;
  difficulty: string | null;
  /** LeetCode frontend number. */
  questionId: string | null;
}

export type { SolveProof };

/** approaches.fork_count is selected but not on the shared Approach type. */
export function copiesOf(a: Approach): number {
  const n = (a as Approach & { fork_count?: number | null }).fork_count;
  return typeof n === "number" && n > 0 ? n : 0;
}
