import type { Approach, StuckLevel } from "@/types/database";

/**
 * Approach comparison (Step 19, Bible §13/§27–§29).
 *
 * The purpose is "learn how friends think", not "declare a winner". Two
 * consequences shape this module:
 *
 *  1. Approaches are grouped by the *technique* they use, not by author. A
 *     reader who has solved it two ways should see both ways side by side.
 *  2. Nothing scores one approach above another. Differences are surfaced as
 *     differences; the page never names a best approach.
 */

/** A coarse technique label, derived rather than authored. */
export type Technique =
  | "single_pass"
  | "two_pointer"
  | "stack"
  | "heap"
  | "graph_search"
  | "dynamic_programming"
  | "divide_conquer"
  | "other";

export interface CompareRow {
  approach: Approach;
  technique: Technique;
  /** Complexity claim, only when both halves were recorded. */
  time: string | null;
  space: string | null;
}

const TECHNIQUE_SIGNALS: { technique: Technique; patterns: RegExp[] }[] = [
  { technique: "dynamic_programming", patterns: [/\bdp\b/i, /dynamic programming/i, /memo/i, /tabulation/i, /\bbottom[- ]up\b/i] },
  { technique: "two_pointer", patterns: [/\btwo[- ]pointer/i, /\bpointers\b/i, /\bsliding window/i, /\bfast.*slow/i, /\bleft.*right/i] },
  { technique: "stack", patterns: [/\bmonotonic stack/i, /\bstack\b/i, /\bnext greater/i, /\bparenthes/i] },
  { technique: "heap", patterns: [/\bheap/i, /\bpriority queue/i, /\bmin[- ]heap/i, /\bpq\b/i] },
  { technique: "graph_search", patterns: [/\bbfs\b/i, /\bdfs\b/i, /breadth[- ]first/i, /depth[- ]first/i, /\bdijkstra/i, /\btopological/i, /\bunion[- ]find/i] },
  { technique: "divide_conquer", patterns: [/\bdivide and conquer/i, /\bmerge sort\b/i, /\bquick ?sort/i, /\bdivide\b/i] },
  { technique: "single_pass", patterns: [/\bsingle pass\b/i, /\bone pass\b/i, /\bone traversal\b/i, /\bscan\b/i, /\bhash(?: map| table)?\b/i, /\bfrequency\b/i] },
];

/**
 * Best-effort technique label from the author's own words (pattern, core idea,
 * key detail). Nulls rather than guessing: an "other" grouping is honest, a
 * wrong confident label is not.
 */
export function inferTechnique(a: {
  pattern?: string | null;
  core_idea?: string | null;
  key_detail?: string | null;
}): Technique {
  const haystack = [a.pattern, a.core_idea, a.key_detail]
    .filter(Boolean)
    .join(" \n ");
  if (!haystack.trim()) return "other";
  for (const { technique, patterns } of TECHNIQUE_SIGNALS) {
    if (patterns.some((p) => p.test(haystack))) return technique;
  }
  return "other";
}

export const TECHNIQUE_LABEL: Record<Technique, string> = {
  single_pass: "Single pass",
  two_pointer: "Two pointers",
  stack: "Stack",
  heap: "Heap",
  graph_search: "Graph search",
  dynamic_programming: "Dynamic programming",
  divide_conquer: "Divide & conquer",
  other: "Other",
};

export interface ComparisonGroup {
  technique: Technique;
  label: string;
  rows: CompareRow[];
}

export interface ComparisonResult {
  groups: ComparisonGroup[];
  /** Distinct techniques present. More than one is the interesting signal. */
  techniqueCount: number;
  total: number;
}

/**
 * Group approaches for side-by-side reading.
 *
 * Ordered by group size descending, so the most common way to solve it is read
 * first. That is a *frequency* fact, not a judgement — and the UI says so.
 */
export function buildComparison(approaches: Approach[]): ComparisonResult {
  const rows: CompareRow[] = approaches.map((approach) => ({
    approach,
    technique: inferTechnique(approach),
    time: approach.complexity_time?.trim() || null,
    space: approach.complexity_space?.trim() || null,
  }));

  const byTechnique = new Map<Technique, CompareRow[]>();
  for (const row of rows) {
    const list = byTechnique.get(row.technique) ?? [];
    list.push(row);
    byTechnique.set(row.technique, list);
  }

  const groups: ComparisonGroup[] = Array.from(byTechnique.entries())
    .map(([technique, groupRows]) => ({
      technique,
      label: TECHNIQUE_LABEL[technique],
      rows: groupRows,
    }))
    .sort((a, b) => b.rows.length - a.rows.length);

  return { groups, techniqueCount: groups.length, total: rows.length };
}

/** True when there is enough to make a side-by-side worth reading. */
export function isComparable(count: number): boolean {
  return count >= 2;
}

/**
 * Points where two approaches actually differ, as neutral observations.
 * Never "A is better than B" — the module has no vocabulary for that.
 */
export function differences(a: CompareRow, b: CompareRow): string[] {
  const out: string[] = [];

  if (a.technique !== b.technique) {
    out.push(`Different approach: ${TECHNIQUE_LABEL[a.technique]} vs ${TECHNIQUE_LABEL[b.technique]}.`);
  }
  if (a.time && b.time && a.time !== b.time) {
    out.push(`Time claim differs: ${a.time} vs ${b.time}. Both may be right for different inputs.`);
  }
  if (a.space && b.space && a.space !== b.space) {
    out.push(`Space claim differs: ${a.space} vs ${b.space}.`);
  }
  if ((a.time && !b.time) || (!a.time && b.time)) {
    out.push("Only one author recorded a time complexity.");
  }
  return out;
}

/** Re-exported so the compare page can show the asker's own ladder level. */
export type { StuckLevel };