import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "prefix-sum",
  pattern: "Prefix Sum",
  title: "Prefix Sum",
  order: 2,
  prerequisites: ["arrays-hashing"],
  summary:
    "Store the running total up to each index once, and the sum of any subarray becomes one subtraction. Paired with a hash map of earlier totals, it counts or finds subarrays with a given sum in one pass, negatives included.",

  recognizeWhen: [
    "You need the sum of many different ranges of an array that doesn't change.",
    "The question asks how many subarrays, or the longest one, with sum equal to k, divisible by k, or balanced between two kinds of element.",
    "The array can contain negative numbers or zeros, so a sliding window can't decide when to shrink.",
    "Each answer depends on everything to the left and everything to the right of i, like a product of all the other elements.",
  ],

  coreIdea: `Let pre[i] be the sum of the first i elements, with pre[0] = 0 for the empty prefix. Then the sum of nums[l..r] is pre[r + 1] − pre[l]: the total up to r, minus the part before l. Building pre takes one pass, and every range sum after that is O(1).

Flip it around to count subarrays. A subarray ending at r has sum k exactly when some earlier prefix equals pre[r + 1] − k. So walk left to right, keep a hash map from each prefix sum to how many times it has appeared, and at each index add the count of prefix − k. Every earlier prefix with that value is the start of one subarray that ends here.

Why it's correct: every subarray is a pair (earlier prefix, current prefix), and each pair is checked exactly once, when you reach its right end. Why it's fast: one pass, one lookup and one insert per element, so O(n). Negative numbers don't matter, because nothing is ever shrunk or skipped.

The {0: 1} seed is the empty prefix. Without it you miss every subarray that starts at index 0. Look up before you record the current prefix, or a subarray of length zero gets counted when k = 0.

The same idea works for anything you can undo. XOR, and counts of each letter, both work. Remainders mod k work, because two prefixes with the same remainder differ by a multiple of k. Max and min don't: you can't subtract a maximum back out, so range maximum needs a different structure.`,

  walkthrough: {
    problemSlug: "subarray-sum-equals-k",
    input: "nums = [1, 2, 3, -3, 3], k = 3",
    intro: "one step per index, starting from {0: 1} for the empty prefix.",
    columns: ["Prefix and map", "Look up prefix − 3", "Count"],
    steps: [
      { window: "1; {0:1, 1:1}", action: "take 1; −2 not seen", best: "0" },
      { window: "3; {0:1, 1:1, 3:1}", action: "take 2; 0 seen once: [1, 2]", best: "1" },
      { window: "6; {…, 3:1, 6:1}", action: "take 3; 3 seen once: [3]", best: "2" },
      { window: "3; {…, 3:2, 6:1}", action: "take −3; 0 seen once: [1, 2, 3, −3]", best: "3" },
      { window: "6; {…, 3:2, 6:2}", action: "take 3; 3 seen twice: [3, −3, 3] and [3]", best: "5" },
    ],
    result: "5. The −3 brought the prefix back down to 3, which a sliding window could never have handled.",
  },

  template: {
    code: "subarray-sum-k",
    note: "Running prefix, look up prefix − k, then record prefix. Change what the map stores (a count, the first index) and what you look up, and most of the ladder falls out.",
  },

  variants: [
    {
      name: "Range sum queries",
      when: "The array is fixed and you're asked for the sum of many ranges.",
      idea: "Build pre once with a leading 0. The sum of nums[left..right] is pre[right + 1] − pre[left], in O(1) per query.",
      code: "range-sum",
      problemSlug: "range-sum-query-immutable",
    },
    {
      name: "Longest: store the first index",
      when: "You want the longest subarray with some sum, not how many.",
      idea:
        "Map each prefix to the first index where it appeared, and never overwrite it. When the same prefix comes back at i, the stretch between has sum 0 and length i − first. Recode 0 as −1 to turn \"equal 0s and 1s\" into \"sum 0\".",
      code: "longest-balanced",
      problemSlug: "contiguous-array",
    },
    {
      name: "Remainders instead of sums",
      when: "The subarray sum has to be divisible by k.",
      idea:
        "Key the map on prefix mod k. Equal remainders mean the part between is a multiple of k. In C++ and Java, % can be negative, so normalise with ((x % k) + k) % k.",
      code: "divisible-by-k",
      problemSlug: "subarray-sums-divisible-by-k",
    },
  ],

  complexity: {
    time: "O(n) to build or scan; O(1) per range query",
    space: "O(n) for the prefix array or the map",
    why: "Each element is added to the running total once, and the map does one lookup and one insert per element at O(1) on average. A query is two array reads and a subtraction.",
  },

  mistakes: [
    "Forgetting the {0: 1} seed (or {0: −1} for first indices), which drops every subarray that starts at index 0.",
    "Recording the current prefix before looking up prefix − k. With k = 0 every element then matches itself.",
    "Off-by-one between nums and pre: pre has n + 1 entries, and the sum of nums[l..r] is pre[r + 1] − pre[l], not pre[r] − pre[l].",
    "Overwriting the first index when you want the longest stretch. Only store a prefix the first time you see it.",
    "Taking % of a negative prefix in C++ or Java and getting a negative remainder that never matches.",
    "Overflow: sums of many large values can exceed 32 bits. Use long long or long when the limits allow it.",
  ],

  notThis: [
    "Every number is positive and you want the shortest or longest window with sum at least k: a sliding window does it in O(1) space.",
    "The array changes between queries: a Fenwick tree or segment tree, since one update would rebuild the whole prefix array.",
    "You need the range maximum or minimum: a monotonic deque for windows, or a sparse table, because max can't be subtracted out.",
  ],

  ladder: [
    { slug: "running-sum-of-1d-array", tier: "warm-up", note: "Build the prefix array and nothing else." },
    { slug: "range-sum-query-immutable", tier: "warm-up", note: "pre[r + 1] − pre[l]: the leading zero earns its place." },
    { slug: "find-pivot-index", tier: "warm-up", note: "Left sum and right sum from one total, with no array at all." },
    { slug: "subarray-sum-equals-k", tier: "core", note: "The template: count earlier prefixes equal to prefix − k." },
    { slug: "contiguous-array", tier: "core", note: "Longest instead of count: store the first index, and treat 0 as −1." },
    { slug: "subarray-sums-divisible-by-k", tier: "core", note: "Key on the remainder, and handle negative %." },
    { slug: "continuous-subarray-sum", tier: "core", note: "Remainders plus first index: the length must be at least 2." },
    { slug: "product-of-array-except-self", tier: "core", note: "Prefix and suffix products, multiplied together, with no division." },
    { slug: "range-sum-query-2d-immutable", tier: "core", note: "Two dimensions: add two rectangles, subtract the overlap." },
    { slug: "car-pooling", tier: "core", note: "A difference array: +p at pickup, −p at drop-off, then one prefix pass." },
    { slug: "number-of-submatrices-that-sum-to-target", tier: "stretch", note: "Fix two rows, squash the columns, and run Subarray Sum Equals K." },
    { slug: "maximum-sum-of-3-non-overlapping-subarrays", tier: "stretch", note: "Window sums from prefixes, plus the best window to the left and right of each middle one." },
  ],
};
