/**
 * Every pattern on the roadmap, in the order they're best learned: each one
 * leans on the ones above it (two pointers before sliding window, trees before
 * graphs, recursion before backtracking before DP). Order is advice, never a
 * lock.
 *
 * `slug` is the primer's slug once it exists in public.primers. A pattern with
 * no primer yet still appears, marked as coming, so the list shows the whole
 * map rather than only what's written.
 */
export interface RoadmapPattern {
  slug: string;
  pattern: string;
  /** One line: what it's for. */
  blurb: string;
}

export const ROADMAP: RoadmapPattern[] = [
  { slug: "arrays-hashing", pattern: "Arrays & Hashing", blurb: "Count, group and look things up in O(1)." },
  { slug: "prefix-sum", pattern: "Prefix Sum", blurb: "Any range sum in O(1) after one pass." },
  { slug: "two-pointers", pattern: "Two Pointers", blurb: "Walk from both ends of sorted data, or fast and slow." },
  { slug: "sliding-window", pattern: "Sliding Window", blurb: "The best contiguous stretch, in one pass." },
  { slug: "binary-search", pattern: "Binary Search", blurb: "Halve the search space, including on the answer." },
  { slug: "stack", pattern: "Stack", blurb: "The most recent unmatched thing decides what's next." },
  { slug: "monotonic-stack", pattern: "Monotonic Stack", blurb: "Next greater or smaller element for every index." },
  { slug: "linked-list", pattern: "Linked List", blurb: "Fast and slow pointers, reversal, merging." },
  { slug: "intervals", pattern: "Intervals", blurb: "Sort by start, then merge, insert or count overlaps." },
  { slug: "heap-top-k", pattern: "Heap / Top-K", blurb: "Keep the k best seen so far." },
  { slug: "greedy", pattern: "Greedy", blurb: "Take the locally best step, when you can prove it's safe." },
  { slug: "tree-dfs", pattern: "Tree DFS", blurb: "Recursion that returns what the parent needs." },
  { slug: "tree-bfs", pattern: "Tree BFS", blurb: "Level by level with a queue." },
  { slug: "bst", pattern: "Binary Search Tree", blurb: "Use the ordering: go left or right, never both." },
  { slug: "trie", pattern: "Trie", blurb: "Prefix lookups over many words." },
  { slug: "graphs-bfs", pattern: "Graph BFS / DFS", blurb: "Visit every reachable node once; BFS for shortest steps." },
  { slug: "topological-sort", pattern: "Topological Sort", blurb: "Order tasks so every dependency comes first." },
  { slug: "union-find", pattern: "Union-Find", blurb: "Which group is this in, merged as you go." },
  { slug: "shortest-path", pattern: "Shortest Path", blurb: "Dijkstra when edges have weights." },
  { slug: "backtracking", pattern: "Backtracking", blurb: "Try a choice, recurse, undo it." },
  { slug: "dp-1d", pattern: "1D Dynamic Programming", blurb: "The answer for i from answers for smaller i." },
  { slug: "dp-2d", pattern: "2D Dynamic Programming", blurb: "Grids, two strings, knapsack." },
  { slug: "bit-manipulation", pattern: "Bit Manipulation", blurb: "XOR tricks, masks and counting bits." },
];
