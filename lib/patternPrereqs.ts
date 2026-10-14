/**
 * Pattern prerequisites (Step 24, Bible §24).
 *
 * Hand-authored, deliberately. §24 says "static lib/patternPrereqs.ts —
 * hand-authored, no ML", and a learned prereq graph would be wrong in a way
 * nobody could argue with. This file is inspectable: if somebody thinks DP does
 * not need Recursion, the fix is a one-line edit and a visible disagreement,
 * not a retrain.
 *
 * Canonical pattern names are the primer names, because primers are the
 * teaching surface and a pattern with no primer is the pattern this map is
 * least confident about. ALIASES folds the two vocabularies this app actually
 * has — LeetCode `problems.topics` and sheet `list_problems.category` — onto
 * those canonical names. Measured against the live catalog rather than guessed:
 * topics run to "Array", "Hash Table", "Binary Search", "Heap (Priority Queue)"
 * while categories run to "Arrays & Hashing", "Stack and Queue", "BST".
 */

/** Canonical pattern -> the patterns you want some exposure to first. */
export const PATTERN_PREREQS: Record<string, string[]> = {
  "Sliding Window": ["Arrays", "Hash Table", "Two Pointers"],
  "Two Pointers": ["Arrays"],
  "Binary Search": ["Arrays"],
  Stack: ["Arrays", "Linked List"],
  "Linked List": ["Arrays"],
  Heap: ["Arrays"],
  "Binary Tree": ["Arrays", "Recursion"],
  BST: ["Binary Tree", "Binary Search"],
  Trees: ["Arrays", "Recursion"],
  Graphs: ["Arrays", "Hash Table", "Recursion"],
  "Breadth-First Search": ["Graphs", "Hash Table"],
  "Depth-First Search": ["Graphs", "Recursion"],
  "Dynamic Programming": ["Arrays", "Recursion", "Hash Table"],
  "1-D Dynamic Programming": ["Arrays", "Hash Table"],
  "2-D Dynamic Programming": ["1-D Dynamic Programming", "Arrays", "Matrix"],
  Backtracking: ["Recursion", "Arrays"],
  Intervals: ["Arrays", "Sorting"],
  Greedy: ["Arrays", "Sorting"],
  Matrix: ["Arrays"],
  "Sorting Algorithms": ["Arrays"],
  "Bit Manipulation": ["Math"],
  String: ["Arrays"],
  Tries: ["Hash Table", "String"],
  "Union Find": ["Hash Table", "Graphs"],
  Segment: ["Arrays", "Binary Search"],
  "Graph Theory": ["Graphs", "Hash Table"],
  "Design": ["Object Oriented Design"],
  "Recursion": ["Arrays"],
  "Object Oriented Design": [],
  Arrays: [],
  "Hash Table": [],
  Sorting: [],
  Math: [],
  Simulation: [],
  Concurrency: [],
  Database: [],
};

/**
 * LeetCode topic / sheet category -> canonical name.
 *
 * Only mappings we actually needed, measured from the live catalog. Anything
 * missing is returned as-is, which is safe: an unknown pattern has no
 * prerequisites, so the engine never blocks a recommendation on a guess.
 */
export const PATTERN_ALIASES: Record<string, string> = {
  array: "Arrays",
  arrays: "Arrays",
  "arrays & hashing": "Arrays",
  "array & hashing": "Arrays",
  string: "String",
  strings: "String",
  "hash table": "Hash Table",
  hashmap: "Hash Table",
  "hash map": "Hash Table",
  map: "Hash Table",
  counting: "Hash Table",
  math: "Math",
  "math & geometry": "Math",
  "number theory": "Math",
  "dynamic programming": "Dynamic Programming",
  "dp": "Dynamic Programming",
  "1-d dynamic programming": "1-D Dynamic Programming",
  "2-d dynamic programming": "2-D Dynamic Programming",
  "depth-first search": "Depth-First Search",
  dfs: "Depth-First Search",
  "breadth-first search": "Breadth-First Search",
  bfs: "Breadth-First Search",
  tree: "Trees",
  trees: "Trees",
  "binary tree": "Binary Tree",
  bst: "BST",
  "binary search tree": "BST",
  "two pointers": "Two Pointers",
  "sliding window": "Sliding Window",
  matrix: "Matrix",
  "binary search": "Binary Search",
  greedy: "Greedy",
  stack: "Stack",
  "stack and queue": "Stack",
  queue: "Stack",
  "bit manipulation": "Bit Manipulation",
  design: "Design",
  "object oriented design": "Object Oriented Design",
  backtracking: "Backtracking",
  database: "Database",
  "linked list": "Linked List",
  "heap (priority queue)": "Heap",
  "priority queue": "Heap",
  heap: "Heap",
  "graph theory": "Graph Theory",
  recursion: "Recursion",
  simulation: "Simulation",
  intervals: "Intervals",
  sorting: "Sorting",
  "sorting algorithms": "Sorting",
  tries: "Tries",
  "union find": "Union Find",
  segment: "Segment",
  concurrency: "Concurrency",
};

/** Lower-cased canonical name -> canonical name, built once from the map keys. */
const CANONICAL_BY_LOWER = new Map(
  Object.keys(PATTERN_PREREQS).map((k) => [k.toLowerCase(), k])
);

/**
 * Fold one topic or category name to its canonical pattern.
 *
 * Three steps, in order: the explicit alias table, then a case-insensitive
 * match against this map's own keys, then the raw name.
 *
 * The middle step exists because the alias table only listed mappings we had a
 * specific reason for, and anything missing silently returned the raw string —
 * so prereqsFor("graphs") came back empty for a pattern this file has an entry
 * for, one letter case away. An unknown pattern returning no prerequisites is
 * safe; a known one returning none is a bug.
 */
export function canonicalPattern(raw: string): string {
  const trimmed = raw.trim();
  const key = trimmed.toLowerCase();
  return (
    PATTERN_ALIASES[key] ?? CANONICAL_BY_LOWER.get(key) ?? trimmed
  );
}

/** Prerequisites for any spelling of a pattern. */
export function prereqsFor(raw: string): string[] {
  return PATTERN_PREREQS[canonicalPattern(raw)] ?? [];
}

export interface PrereqVerdict {
  /** Canonical names that have enough exposure to justify moving on. */
  met: string[];
  /** Canonical names with not enough exposure yet. */
  unmet: string[];
  /** True when every prerequisite is met, or there are none. */
  ready: boolean;
}

/**
 * Which prerequisites are met, given the caller's exposure per pattern.
 *
 * `exposure` is solved-or-attempted counts per canonical pattern. A prerequisite
 * with exposure 0 is unmet. `threshold` is deliberately low (2): the point is
 * "you have met this idea before", not "you have mastered it".
 *
 * The threshold is a constant rather than a claim about mastery, and the why
 * bullet it produces says which prerequisites were met by name — so a reader
 * can check the claim instead of trusting it.
 */
export function prereqStatus(
  raw: string,
  exposure: Map<string, number>,
  threshold = 2
): PrereqVerdict {
  const prereqs = prereqsFor(raw);
  const met: string[] = [];
  const unmet: string[] = [];
  for (const p of prereqs) {
    if ((exposure.get(canonicalPattern(p)) ?? 0) >= threshold) met.push(canonicalPattern(p));
    else unmet.push(canonicalPattern(p));
  }
  return { met, unmet, ready: unmet.length === 0 };
}

/** Every canonical pattern this map knows about, for callers that enumerate. */
export function knownPatterns(): string[] {
  return Object.keys(PATTERN_PREREQS);
}