import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "sliding-window",
  pattern: "Sliding Window",
  title: "Sliding Window",
  order: 4,
  prerequisites: ["two-pointers"],
  summary:
    "For questions about a contiguous stretch of an array or string: the best, longest, shortest or count of subarrays that meet a rule. Two indices walk forward together, so each element is looked at a constant number of times.",

  recognizeWhen: [
    "The answer is a contiguous subarray or substring, and the question says longest, shortest, maximum, minimum or how many.",
    "There's a rule the stretch has to satisfy: at most k distinct, no repeats, sum at least target, contains every character of t.",
    "A fixed length k is given and you need something about every window of that length.",
    "The brute force is two nested loops over start and end. That's the O(n²) the window removes.",
  ],

  coreIdea: `Keep a window [left, right] and a small summary of what's inside it: a count map, a running sum, a set. Move right one step at a time to take a new element in. Whenever the window breaks the rule, move left forward until it's valid again, taking elements out of the summary as they leave.

Neither index ever moves backwards, so each element enters the window once and leaves at most once. That's why the whole scan is O(n), even though there's a loop inside a loop.

The shrinking step only works if the rule is monotonic: if a window is invalid, every larger window that contains it is invalid too. "No repeated characters" is like that: adding characters never removes a repeat. When a rule isn't monotonic (a sum with negative numbers in it), shrinking from the left can skip the answer, and you need a different tool.

Fixed-size windows are the simple case: the window is always k long, so each step adds one element and removes one.`,

  walkthrough: {
    problemSlug: "longest-substring-without-repeating-characters",
    input: 's = "pwwkew"',
    intro: "one step per character.",
    columns: ["Window", "What happened", "Best"],
    steps: [
      { window: "[p]", action: "take p", best: "1" },
      { window: "[p w]", action: "take w", best: "2" },
      { window: "p w [w]", action: "take w → w twice; drop p, drop w", best: "2" },
      { window: "p w [w k]", action: "take k", best: "2" },
      { window: "p w [w k e]", action: "take e", best: "3" },
      { window: "p w w [k e w]", action: "take w → w twice; drop w", best: "3" },
    ],
    result: "3, for \"wke\" (or \"kew\")",
  },

  template: {
    code: "longest-substring",
    note: "Grow, shrink while invalid, record. Almost every variable-size window problem is these three lines with a different summary and a different rule.",
  },

  variants: [
    {
      name: "Fixed size k",
      when: "The window length is given.",
      idea: "Build the first window once, then slide: add nums[right], remove nums[right − k]. No while loop.",
      code: "fixed-window",
      problemSlug: "maximum-average-subarray-i",
    },
    {
      name: "Count windows: exactly K = at most K − at most K−1",
      when: "The question asks how many subarrays have exactly k of something.",
      idea:
        "Counting \"exactly\" directly doesn't shrink cleanly, but \"at most\" does: for each right, every window from left to right is valid, so add right − left + 1. Then subtract the at-most-(k−1) count.",
      code: "exactly-k",
      problemSlug: "subarrays-with-k-different-integers",
    },
    {
      name: "Max or min of every window",
      when: "You need the largest (or smallest) value in each window of size k.",
      idea:
        "Keep a deque of indices whose values decrease from front to back. A new value pops every smaller one off the back, since they can't be a maximum again while it's in the window. The front is the answer; drop it once it slides out.",
      code: "window-max",
      problemSlug: "sliding-window-maximum",
    },
  ],

  complexity: {
    time: "O(n)",
    space: "O(k), or O(size of the alphabet) for character counts",
    why: "left and right each move from 0 to n at most once, so all the shrinking across the whole scan adds up to n steps, not n per step. The deque variant is O(n) for the same reason: each index is pushed once and popped at most once.",
  },

  mistakes: [
    "Shrinking with if instead of while. One removal isn't always enough to make the window valid again (\"abba\" is a quick test).",
    "Forgetting to take the left element out of the summary when it leaves: decrement its count, subtract it from the sum.",
    "Recording the answer before the window is valid again. Record after the shrink loop.",
    "Off-by-one in the length: a window from left to right holds right − left + 1 elements.",
    "Leaving zero-count keys in the map when you use the map's size as \"distinct count\". Delete them.",
    "Reaching for a sum window when the array has negative numbers.",
  ],

  notThis: [
    "Subarray sum equals k with negative numbers allowed: shrinking from the left can skip the answer. Use prefix sums with a hash map.",
    "The elements don't have to be contiguous (subsequences): that's usually DP or greedy.",
    "The pair you're looking for can be anywhere in a sorted array: that's two pointers from both ends, not a window.",
  ],

  ladder: [
    { slug: "maximum-average-subarray-i", tier: "warm-up", note: "Fixed window, a running sum. The smallest possible version." },
    { slug: "contains-duplicate-ii", tier: "warm-up", note: "Fixed window kept as a set: is there a repeat within k?" },
    { slug: "maximum-number-of-vowels-in-a-substring-of-given-length", tier: "warm-up", note: "Fixed window with a count instead of a sum." },
    { slug: "longest-substring-without-repeating-characters", tier: "core", note: "The template itself: grow, shrink while there's a repeat, record." },
    { slug: "minimum-size-subarray-sum", tier: "core", note: "Shortest instead of longest: record inside the shrink loop." },
    { slug: "max-consecutive-ones-iii", tier: "core", note: "The rule is a budget: at most k zeros in the window." },
    { slug: "longest-repeating-character-replacement", tier: "core", note: "Window length minus its most common letter must stay ≤ k." },
    { slug: "permutation-in-string", tier: "core", note: "Fixed window compared against a target count." },
    { slug: "subarray-product-less-than-k", tier: "core", note: "Counting windows: add right − left + 1 each step." },
    { slug: "count-number-of-nice-subarrays", tier: "core", note: "Exactly k odds = at most k − at most k−1." },
    { slug: "minimum-window-substring", tier: "stretch", note: "Shortest window that covers every needed character, with a counter of what's still missing." },
    { slug: "sliding-window-maximum", tier: "stretch", note: "The monotonic deque." },
    { slug: "subarrays-with-k-different-integers", tier: "stretch", note: "Exactly K distinct, the at-most trick at full strength." },
  ],
};
