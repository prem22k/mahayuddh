import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "dp-1d",
  pattern: "Dynamic Programming",
  title: "1D Dynamic Programming",
  order: 21,
  prerequisites: ["backtracking"],
  summary:
    "For questions that ask for the best total, the fewest steps or the number of ways, where the answer at position i is built from answers at smaller positions. Fill one array from the base cases up, and each subproblem is solved once.",

  recognizeWhen: [
    "The question asks for a maximum, a minimum, a count of ways, or whether something is possible, not for the list of answers.",
    "A choice at each position (take it or skip it, which coin, where to cut) affects what's allowed next.",
    "The brute-force recursion calls itself on the same smaller input many times, like f(n − 1) and f(n − 2) both calling f(n − 3).",
    "Greedy almost works but a small example breaks it: coins [1, 3, 4] for 6, or houses [2, 1, 1, 2].",
  ],

  coreIdea: `Dynamic programming is recursion that remembers. If a problem's best answer is built from best answers to smaller versions of itself, and those smaller versions repeat, solve each one once and store it. Use the same four-part recipe every time.

State: say in words what dp[i] means, for example "the most money from the first i houses". Transition: write dp[i] from smaller entries by asking what the last decision was. Either house i is skipped, giving dp[i − 1], or it is robbed, giving dp[i − 2] + nums[i − 1]. Take the larger. Base cases: the entries the transition can't build, here dp[0] = 0 and dp[1] = nums[0]. Order: fill i so that everything dp[i] reads is already done, which is left to right here.

Why it's correct: the transition covers every possible last decision, and each option uses a smaller entry that is already the best for its own range. Why it's fast: n states, each built from a few others, so O(n) time instead of the exponential tree of plain recursion.

You can write the same thing top-down. Recurse from dp(n), and cache each result in a memo the first time you compute it. Memo is easier to get right, because the recursion works out the order for you. A table avoids deep recursion and makes the next step easy: if dp[i] only reads dp[i − 1] and dp[i − 2], keep two variables instead of the array, and space drops from O(n) to O(1).

When the state needs two numbers, like a position in each of two strings, it is 2D DP. When there are no repeated subproblems and you need every answer listed, use backtracking. When one local choice is provably always safe, greedy is simpler.`,

  walkthrough: {
    problemSlug: "house-robber",
    input: "nums = [2, 7, 9, 3, 1]",
    intro: "one step per table entry, filling dp[i] = the most from the first i houses, left to right.",
    columns: ["dp so far", "How dp[i] was filled", "dp[i]"],
    steps: [
      { window: "[0]", action: "base: dp[0] = 0, no houses", best: "0" },
      { window: "[0, 2]", action: "base: dp[1] = nums[0] = 2", best: "2" },
      { window: "[0, 2, 7]", action: "i = 2: skip gives dp[1] = 2; rob 7 gives dp[0] + 7 = 7", best: "7" },
      { window: "[0, 2, 7, 11]", action: "i = 3: skip gives 7; rob 9 gives dp[1] + 9 = 11", best: "11" },
      { window: "[0, 2, 7, 11, 11]", action: "i = 4: skip gives 11; rob 3 gives dp[2] + 3 = 10", best: "11" },
      { window: "[0, 2, 7, 11, 11, 12]", action: "i = 5: skip gives 11; rob 1 gives dp[3] + 1 = 12", best: "12" },
    ],
    result: "12, from houses 2 + 9 + 1. At i = 4 the table kept 11 instead of taking 3; that's the step greedy can't make.",
  },

  template: {
    code: "house-robber",
    note: "Write the state as a comment first, then the base cases, then the loop with the transition. If the loop only reads the last one or two entries, swap the array for that many variables.",
  },

  variants: [
    {
      name: "Two variables instead of the array",
      when: "dp[i] reads only the last one or two entries, or the input is a circle that you split into two lines.",
      idea:
        "Keep prev2 and prev1 for dp[i − 2] and dp[i − 1] and shift them each step, for O(1) space. For a circle, the first and last houses can't both be robbed, so solve the line without the last house and the line without the first, and take the better.",
      code: "house-robber-circle",
      problemSlug: "house-robber-ii",
    },
    {
      name: "Minimum over choices, with an impossible marker",
      when: "Each step picks one of several options (which coin) and some totals can't be reached at all.",
      idea:
        "dp[a] = min over coins c ≤ a of dp[a − c] + 1. Fill with a value that can never be a real answer (amount + 1), so unreachable states stay unreachable instead of looking like 0.",
      code: "coin-change",
      problemSlug: "coin-change",
    },
    {
      name: "State that ends at i",
      when: "The answer is a subsequence that can end anywhere, like the longest increasing one.",
      idea:
        "Define dp[i] as the best that ends exactly at i. The transition looks at every j < i that can come before i. The answer is max(dp), not dp[n − 1].",
      code: "lis",
      problemSlug: "longest-increasing-subsequence",
    },
  ],

  complexity: {
    time: "O(n) for house robber; O(n · k) for k coins; O(n²) for LIS",
    space: "O(n) for the table, or O(1) with rolling variables",
    why: "Each state is filled once, and the cost of filling it is the number of options the transition checks: 2 for house robber, one per coin for coin change, every earlier index for LIS. The table holds one entry per state; when the transition only reads the last two entries, two variables are enough.",
  },

  mistakes: [
    "Starting to code before writing the state in words. If you can't say what dp[i] means, the transition will be wrong.",
    "Filling in the wrong order, so dp[i] reads an entry that hasn't been computed yet.",
    "Off-by-one between dp and nums: with dp over the first i items, item i is nums[i − 1].",
    "Using 0 or −1 for unreachable states in a min problem. Use a value larger than any real answer and check for it at the end.",
    "Returning dp[n − 1] when the state is \"ends at i\". The best run can end anywhere; take the max.",
    "Rolling to two variables and overwriting prev1 before prev2 has read it. Compute the new value first, then shift.",
    "Memoising on a state that leaves something out (like the circle in House Robber II). Two calls that look the same then need different answers.",
  ],

  notThis: [
    "The question wants every arrangement listed, not a count or a best: use backtracking.",
    "The state needs two indices, like positions in two strings or a row and a column: that's 2D DP.",
    "A local choice is provably always safe, like taking the earliest-ending interval: greedy, with no table.",
    "You need the best contiguous subarray sum and numbers can be negative: Kadane's algorithm is this DP with one variable, so write it that way rather than building a table.",
  ],

  ladder: [
    { slug: "climbing-stairs", tier: "warm-up", note: "dp[i] = dp[i − 1] + dp[i − 2]: count ways, then roll to two variables." },
    { slug: "min-cost-climbing-stairs", tier: "warm-up", note: "The same shape with a min and a cost per step. Get the base cases right." },
    { slug: "house-robber", tier: "core", note: "The template: take or skip, max of the two." },
    { slug: "house-robber-ii", tier: "core", note: "A circle: run the line twice, once without each end." },
    { slug: "delete-and-earn", tier: "core", note: "Turn it into House Robber over values: count each value, then take or skip v." },
    { slug: "decode-ways", tier: "core", note: "Count ways with conditions: one-digit and two-digit steps, and '0' can't stand alone." },
    { slug: "coin-change", tier: "core", note: "Minimum over choices, with an impossible marker for amounts you can't make." },
    { slug: "word-break", tier: "core", note: "A boolean state: dp[i] is true if some word ends at i after a true dp[j]." },
    { slug: "maximum-product-subarray", tier: "core", note: "Keep the best and the worst ending at i, because a negative flips them." },
    { slug: "longest-increasing-subsequence", tier: "core", note: "State that ends at i, answer is the max over all i. Then try the O(n log n) version." },
    { slug: "best-time-to-buy-and-sell-stock-with-cooldown", tier: "stretch", note: "Several states per day (holding, sold, resting), each with its own transition." },
    { slug: "maximum-profit-in-job-scheduling", tier: "stretch", note: "Sort by end time; dp[i] takes job i plus the best before its start, found by binary search." },
    { slug: "russian-doll-envelopes", tier: "stretch", note: "LIS in disguise: sort one side, break ties the right way, then LIS in O(n log n)." },
  ],
};
