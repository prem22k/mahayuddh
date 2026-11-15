import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "backtracking",
  pattern: "Backtracking",
  title: "Backtracking",
  order: 20,
  prerequisites: ["tree-dfs"],
  summary:
    "For questions that want every arrangement: all subsets, permutations, combinations, or every board that follows the rules. Build an answer one choice at a time, recurse, then undo the choice and try the next one.",

  recognizeWhen: [
    "The question says all, every or list: all subsets, all permutations, every way to split a string.",
    "Inputs are small (n up to about 10 to 20), because the number of answers itself is 2^n or n!.",
    "An answer is built from a sequence of choices, and some partial answers can already be ruled out.",
    "It's a puzzle with rules to place against: N-Queens, Sudoku, a word in a grid.",
  ],

  coreIdea: `Picture a tree of decisions. The root is the empty answer. Each edge adds one choice, and each leaf is a finished answer. Backtracking walks this tree depth first and keeps only one path in memory. At each node it loops over the choices left: choose one (add it to the path), recurse, then un-choose it (remove it from the path) before trying the next.

The invariant: when backtrack() returns, the path is exactly what it was when it was called. That's why one shared list is enough, and why every choose needs a matching un-choose. When you record an answer, record a copy. The path keeps changing after you save it.

Three knobs cover most problems. A start index means you only pick later elements, so {1, 2} and {2, 1} can't both appear. That gives subsets and combinations. A used[] array lets any unused element go next, which gives permutations. Recursing with i instead of i + 1 lets an element be picked again.

The work is the size of the tree: about 2^n nodes for subsets and n · n! for permutations, times the cost of copying each answer. You can't beat the number of answers. You can stop early with pruning: after sorting, if one candidate is already too big, every later one is too, so break. For duplicates in the input, sort and skip nums[i] when it equals nums[i − 1] at the same depth, because that branch would build the same subtree again.

It breaks down when the question only wants a count or the best value and the same subproblem comes up many times. Then use dynamic programming.`,

  walkthrough: {
    problemSlug: "subsets",
    input: "nums = [1, 2, 3]",
    intro: "one step per subset recorded. Each call records its path first, then tries every later index.",
    columns: ["Path", "Choices made", "Subsets recorded"],
    steps: [
      { window: "[]", action: "backtrack(0) records the empty path", best: "1" },
      { window: "[1]", action: "choose 1, call backtrack(1), record", best: "2" },
      { window: "[1, 2]", action: "choose 2, call backtrack(2), record", best: "3" },
      { window: "[1, 2, 3]", action: "choose 3, call backtrack(3), record. No index left, so return", best: "4" },
      { window: "[1, 3]", action: "un-choose 3, then 2. Back in backtrack(1), choose 3 and record", best: "5" },
      { window: "[2]", action: "un-choose 3, then 1. Back in backtrack(0), choose 2 and record", best: "6" },
      { window: "[2, 3]", action: "choose 3, call backtrack(3), record", best: "7" },
      { window: "[3]", action: "un-choose 3, then 2. Back in backtrack(0), choose 3 and record", best: "8" },
    ],
    result: "8 subsets: [], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]. Each set appears once because a path only ever adds a later index.",
  },

  template: {
    code: "subsets",
    note: "Record, then for each choice: choose, recurse, un-choose. Where you record (every node or only full paths) and where the loop starts (start, 0 or i) are what change between problems.",
  },

  variants: [
    {
      name: "Permutations: used[] instead of start",
      when: "Order matters, so [1, 2] and [2, 1] are different answers.",
      idea:
        "Loop over every index from 0 and skip the ones marked used. Record only when the path has n elements. Un-choose both the path and the used mark.",
      code: "permutations",
      problemSlug: "permutations",
    },
    {
      name: "Reuse allowed, with pruning",
      when: "Each number can be picked any number of times to reach a target.",
      idea:
        "Recurse with i, not i + 1, so the same number stays available. Sort first; then once nums[i] is bigger than what's left, break, because every later number is bigger too.",
      code: "combination-sum",
      problemSlug: "combination-sum",
    },
    {
      name: "Duplicates in the input",
      when: "The input has repeated values, and the answer must not list the same subset twice.",
      idea:
        "Sort so equal values sit together. In the loop, skip nums[i] when i > start and nums[i] == nums[i − 1]: picking the second 2 at the same depth would rebuild the subtree the first 2 already built.",
      code: "subsets-dup",
      problemSlug: "subsets-ii",
    },
  ],

  complexity: {
    time: "O(n · 2^n) for subsets; O(n · n!) for permutations",
    space: "O(n) for the path and the recursion, plus the output",
    why: "There are 2^n subsets and n! permutations, and copying each one into the output costs up to n. The recursion is never deeper than n, and only one path exists at a time. Pruning cuts the tree in practice but not in the worst case.",
  },

  mistakes: [
    "Appending the path itself instead of a copy. Every saved answer then points to the same list, which ends up empty.",
    "Forgetting the un-choose step, or undoing only half of it (the path but not used[i]).",
    "Using i instead of i + 1 (or the reverse). One allows reuse and the other doesn't; read the problem.",
    "Starting the loop from 0 for subsets or combinations. You get [1, 2] and [2, 1] as separate answers.",
    "Skipping duplicates without sorting first. Equal values that aren't next to each other are never caught.",
    "Writing the duplicate skip as i > 0 instead of i > start. That also blocks [2, 2], which is a valid subset.",
    "Breaking on a too-big candidate when the array isn't sorted. Later, smaller candidates get skipped.",
  ],

  notThis: [
    "The question asks how many ways, or the best total, not the list of answers: dynamic programming counts them without listing each one.",
    "n is large, like 10^5. No list of all answers fits, so look for greedy, two pointers or DP.",
    "You only need to visit each cell or node once to find what's connected: plain DFS or BFS, with no un-choose. See Graph BFS / DFS.",
    "Subsets of up to about 20 items where you only check each one: a loop over bitmasks from 0 to 2^n − 1 is shorter. See Bit Manipulation.",
  ],

  ladder: [
    { slug: "subsets", tier: "warm-up", note: "The template: record at every node, loop from start." },
    { slug: "combinations", tier: "warm-up", note: "Subsets of size k: record only when the path is full, and stop when too few numbers are left." },
    { slug: "letter-combinations-of-a-phone-number", tier: "warm-up", note: "One digit per depth, one letter per branch. Choices come from a lookup table." },
    { slug: "permutations", tier: "core", note: "A used[] array instead of a start index." },
    { slug: "subsets-ii", tier: "core", note: "Duplicates: sort, then skip equal values at the same depth." },
    { slug: "combination-sum", tier: "core", note: "Reuse with i, and prune with break once the sorted candidates are too big." },
    { slug: "combination-sum-ii", tier: "core", note: "No reuse and duplicate inputs: i + 1 together with the same-depth skip." },
    { slug: "permutations-ii", tier: "core", note: "Duplicates in permutations: skip nums[i] if it equals nums[i − 1] and that one isn't in use." },
    { slug: "generate-parentheses", tier: "core", note: "Prune by rule: never more ')' than '(' so far, never more than n of either." },
    { slug: "palindrome-partitioning", tier: "core", note: "Choose where the next piece ends, and only recurse when that piece is a palindrome." },
    { slug: "word-search", tier: "core", note: "Backtracking on a grid: mark the cell as used, explore four ways, unmark it." },
    { slug: "n-queens", tier: "stretch", note: "One queen per row, with sets for columns and both diagonals to prune in O(1)." },
    { slug: "sudoku-solver", tier: "stretch", note: "Fill one empty cell at a time, and return as soon as one full board works." },
    { slug: "word-search-ii", tier: "stretch", note: "Many words at once: walk a trie alongside the grid so dead prefixes stop early." },
  ],
};
