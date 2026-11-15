import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "dp-2d",
  pattern: "Dynamic Programming",
  title: "2D Dynamic Programming",
  order: 22,
  prerequisites: ["dp-1d"],
  summary:
    "Dynamic programming where the state needs two numbers: a row and a column of a grid, a position in each of two strings, or an item and a remaining capacity. Fill a table cell by cell so every cell's inputs are already done.",

  recognizeWhen: [
    "Two strings are compared or transformed: a common subsequence, an edit distance, whether one interleaves the others.",
    "A grid where you move only right and down, and want the number of paths or the cheapest one.",
    "Each item is taken or left once, under a limit on total weight or sum: 0/1 knapsack, subset sum, partition.",
    "A 1D state isn't enough because the answer also depends on a second thing, like how much budget is left.",
  ],

  coreIdea: `The recipe is the same as 1D DP, with one more index. State: say what dp[i][j] means, in words. For two strings it's usually "the answer for the first i letters of one and the first j letters of the other". For a grid it's "the answer for reaching cell (i, j)". For knapsack it's "using only the first i items, with capacity j".

Transition: look at the last decision. In LCS, if the last letters match, use them both: dp[i − 1][j − 1] + 1. If not, one of the two letters isn't in the answer, so take the better of dp[i − 1][j] and dp[i][j − 1]. Base cases: row 0 and column 0, where one side is empty. Order: row by row, left to right, because each cell reads the cell above, the one to its left and the one diagonally up-left.

Why it's correct: every option for the last step is covered, and each one points to a smaller prefix whose cell already holds its best answer. Why it's fast: m · n cells, each filled in O(1), so O(m · n) time. That replaces an exponential number of subsequences or paths.

Space: if row i reads only row i − 1, keep one row of length n + 1. In a grid, dp[c] still holds the cell above until you overwrite it, and dp[c − 1] already holds the cell to the left. In 0/1 knapsack, loop the capacity from high to low. A left-to-right loop would read values from this row and let one item be used twice.

It's the wrong tool when the state needs more than you can store: two indices of 10^5 each is 10^10 cells. Then look for a greedy rule, a smaller state, or a different structure.`,

  walkthrough: {
    problemSlug: "longest-common-subsequence",
    input: 'text1 = "abcde", text2 = "ace"',
    intro: "one step per row of the table. Row i is text1's first i letters; columns j = 0 to 3 are text2's first j letters.",
    columns: ["Row (dp[i][0..3])", "How the row filled", "dp[i][3]"],
    steps: [
      { window: "row 0: 0 0 0 0", action: "base: with no letters of text1 there is nothing in common", best: "0" },
      { window: "'a': 0 1 1 1", action: "i = 1: 'a' matches text2's 'a' at j = 1, so dp[0][0] + 1 = 1. j = 2 and 3 take 1 from the left", best: "1" },
      { window: "'b': 0 1 1 1", action: "i = 2: 'b' matches nothing. Each cell is the max of above and left", best: "1" },
      { window: "'c': 0 1 2 2", action: "i = 3: 'c' matches at j = 2, so dp[2][1] + 1 = 2. j = 3 takes 2 from the left", best: "2" },
      { window: "'d': 0 1 2 2", action: "i = 4: 'd' matches nothing, so the row repeats the one above", best: "2" },
      { window: "'e': 0 1 2 3", action: "i = 5: 'e' matches at j = 3, so dp[4][2] + 1 = 3", best: "3" },
    ],
    result: '3, the subsequence "ace". Each match came from the diagonal, and every other cell copied the better of its two neighbours.',
  },

  template: {
    code: "lcs",
    note: "An (m + 1) × (n + 1) table with row 0 and column 0 as the empty base cases. Match: diagonal + 1. No match: best of above and left. Change the meaning and the transition, and edit distance, interleaving and palindromic subsequence use the same loop.",
  },

  variants: [
    {
      name: "Grid paths with one row",
      when: "You move right or down through a grid and want the cheapest path or the number of paths.",
      idea:
        "dp[c] = grid[r][c] + min(above, left). Keep one row: before you overwrite dp[c] it is the cell above, and dp[c − 1] is the cell to the left in this row. Start with a pretend 0 above the first cell.",
      code: "min-path-sum",
      problemSlug: "minimum-path-sum",
    },
    {
      name: "Three choices: edit distance",
      when: "You turn one string into another with insert, delete and replace, each costing 1.",
      idea:
        "Base cases are no longer 0: turning i letters into none costs i deletes, and none into j letters costs j inserts. On a mismatch, take 1 + the min of delete (above), insert (left) and replace (diagonal).",
      code: "edit-distance",
      problemSlug: "edit-distance",
    },
    {
      name: "0/1 knapsack in one row",
      when: "Each number is used at most once and you need a target sum, or the best value within a capacity.",
      idea:
        "The table is dp[item][sum]. Keep one row and loop the sum from high to low, so can[s − x] is still the previous item's row. Looping low to high would let the same item count twice.",
      code: "knapsack-01",
      problemSlug: "partition-equal-subset-sum",
    },
  ],

  complexity: {
    time: "O(m · n) cells, each filled in O(1); O(n · target) for knapsack",
    space: "O(m · n) for the full table, or O(n) with one row",
    why: "There is one cell per pair of indices, and each looks at a fixed number of neighbours (two or three). When a row reads only the row above, one row of storage is enough. For LCS and edit distance you can only keep one row if you don't need to rebuild the actual string afterwards.",
  },

  mistakes: [
    "Mixing up dp indexes and string indexes. With dp over the first i letters, the letter is text1[i − 1].",
    "Leaving row 0 and column 0 at 0 for edit distance. They are i and j: deletes and inserts.",
    "Looping capacity left to right in 0/1 knapsack, which quietly turns it into unbounded knapsack.",
    "Shrinking to one row when the transition needs the diagonal, and overwriting it before it's read. Save it in a variable first.",
    "In a grid, forgetting the first row and first column have only one way in.",
    "Allocating m × n when m and n are both large. Check the limits before you build the table.",
    "Skipping the quick check that makes a knapsack impossible, such as an odd total in Partition Equal Subset Sum.",
  ],

  notThis: [
    "The state is a single index, like a position in one array: that's 1D DP, with one array or two variables.",
    "Moves can go in any direction on a grid, or cells have weights and you want the cheapest route: Dijkstra or BFS, because the grid has no fixed order to fill. See Shortest Path.",
    "Items can be used any number of times and order doesn't matter: unbounded knapsack, which loops the sum low to high, or plain 1D DP over the amount (Coin Change).",
    "You need every arrangement listed, not a count or a best: use backtracking.",
  ],

  ladder: [
    { slug: "unique-paths", tier: "warm-up", note: "Count grid paths: above + left, with the first row and column all 1." },
    { slug: "unique-paths-ii", tier: "warm-up", note: "Obstacles set a cell to 0, including on the first row and column." },
    { slug: "minimum-path-sum", tier: "warm-up", note: "Min instead of sum, then shrink the table to one row." },
    { slug: "longest-common-subsequence", tier: "core", note: "The template for two strings: diagonal on a match, best neighbour otherwise." },
    { slug: "edit-distance", tier: "core", note: "Three operations, and base cases that aren't 0." },
    { slug: "partition-equal-subset-sum", tier: "core", note: "0/1 knapsack as true or false, one row, capacity looped downwards." },
    { slug: "target-sum", tier: "core", note: "Turn the signs into a subset-sum count, then 0/1 knapsack that counts ways." },
    { slug: "coin-change-ii", tier: "core", note: "Unbounded knapsack that counts combinations: coins in the outer loop, so order doesn't matter." },
    { slug: "longest-palindromic-subsequence", tier: "core", note: "dp[i][j] over a range of one string, filled from short ranges to long ones." },
    { slug: "maximal-square", tier: "core", note: "A cell's square is 1 + the min of its three neighbours' squares." },
    { slug: "interleaving-string", tier: "core", note: "A boolean table over two prefixes: the next letter of s3 comes from s1 or from s2." },
    { slug: "distinct-subsequences", tier: "stretch", note: "Count, not best: on a match, add the ways that use the letter and the ways that skip it." },
    { slug: "longest-increasing-path-in-a-matrix", tier: "stretch", note: "No fixed fill order: memoised DFS, where each cell's answer depends on its larger neighbours." },
    { slug: "regular-expression-matching", tier: "stretch", note: "Two strings with '*' meaning zero or more of the letter before it: the transition branches on the pattern." },
  ],
};
