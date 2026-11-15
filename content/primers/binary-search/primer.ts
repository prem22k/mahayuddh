import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "binary-search",
  pattern: "Binary Search",
  title: "Binary Search",
  order: 5,
  prerequisites: ["two-pointers"],
  summary:
    "When a yes/no question flips from no to yes exactly once as you move along a sorted range, find the flip point by halving the range each step. It searches sorted arrays in O(log n), and it also searches over possible answers, like the slowest speed that still finishes in time.",

  recognizeWhen: [
    "The input is sorted, or sorted and then rotated, and you need a position: where x is, where it would go, its first or last copy.",
    "The question asks for the minimum or maximum value that still works, and checking one guess is easy (\"can she finish at speed k?\").",
    "Making the guess bigger only ever makes the check easier, or only ever harder. That one-way change is what lets you throw half away.",
    "The limits are huge (values up to 10⁹) or the expected time is O(log n) or O(n log m).",
  ],

  coreIdea: `Think of a yes/no question about each index (or each candidate answer) that is no, no, ..., no, yes, yes, ..., yes. For search insert position it's \"is nums[i] >= target?\". Binary search finds the first yes.

Keep a range lo..hi that is known to contain the first yes, where hi can also mean \"no yes at all\". Look at mid. If mid is yes, the first yes is mid or to its left, so hi = mid. If mid is no, then mid and everything before it are no, so lo = mid + 1. The loop runs while lo < hi and stops with lo == hi on the answer.

That's correct because each step keeps the answer inside lo..hi. It terminates because mid is always below hi, so either hi drops to mid or lo rises past mid: the range shrinks every time. It's fast because the range halves, so a million items take about 20 steps.

Binary search on the answer is the same loop over values instead of indices. For Koko, speeds 1..max(piles) give no, no, ..., yes, yes as speed grows, and each check is a pass over the piles. Total cost is O(n log max).

It breaks when the question isn't one-way. If yes can turn back into no further on, halving throws away answers. Mixed-up bounds break it too: decide once whether hi is included, and write every line to match.`,

  walkthrough: {
    problemSlug: "search-insert-position",
    input: "nums = [1, 3, 4, 6, 8, 9, 11, 13, 15, 18], target = 12",
    intro: "one step per check of mid, looking for the first nums[i] >= 12.",
    columns: ["lo, hi", "Check", "Answer is in"],
    steps: [
      { window: "lo = 0, hi = 10", action: "start: any index, or 10 for \"at the end\"", best: "0..10" },
      { window: "lo = 6, hi = 10", action: "mid = 5: 9 < 12, so lo = 6", best: "6..10" },
      { window: "lo = 6, hi = 8", action: "mid = 8: 15 >= 12, so hi = 8", best: "6..8" },
      { window: "lo = 6, hi = 7", action: "mid = 7: 13 >= 12, so hi = 7", best: "6..7" },
      { window: "lo = 7, hi = 7", action: "mid = 6: 11 < 12, so lo = 7; lo == hi, stop", best: "7" },
    ],
    result: "7: 12 goes just before 13. Four checks for ten elements.",
  },

  template: {
    code: "lower-bound",
    note: "Find the first index where a one-way condition is true. hi = mid on yes, lo = mid + 1 on no, stop when lo == hi. Swap the condition and nearly every problem on the ladder uses this same loop.",
  },

  variants: [
    {
      name: "Binary search on the answer",
      when: "You want the smallest (or largest) value that passes a check, and passing is one-way.",
      idea:
        "Search values, not indices: lo = 1, hi = max(piles). The yes/no question is \"does speed k finish within h hours?\" Count the hours in 64 bits, since slow speeds over big piles pass 2³¹.",
      code: "koko",
      problemSlug: "koko-eating-bananas",
    },
    {
      name: "Rotated sorted array",
      when: "A sorted array was rotated, and you need the minimum (or a target).",
      idea:
        "Values <= the last element are exactly the rotated-in right part, so \"nums[i] <= last\" is no, ..., yes. The first yes is the minimum. Same loop, different question.",
      code: "rotated-min",
      problemSlug: "find-minimum-in-rotated-sorted-array",
    },
    {
      name: "First and last position",
      when: "Values repeat and you need the whole block of one value.",
      idea:
        "The first copy is the first index with nums[i] >= target. The last copy sits one before the first index with nums[i] >= target + 1. Two runs of the template, no special cases.",
      code: "first-last",
      problemSlug: "find-first-and-last-position-of-element-in-sorted-array",
    },
  ],

  complexity: {
    time: "O(log n); O(n log m) on the answer, where m is the size of the value range",
    space: "O(1)",
    why: "The range halves every step, so it takes about log₂ n steps to shrink to one. On the answer, each of the log m steps runs an O(n) check.",
  },

  mistakes: [
    "Mixing range styles, like hi = n − 1 with while lo < hi and hi = mid − 1. Choose one meaning for hi and keep it.",
    "lo = mid instead of lo = mid + 1. When hi = lo + 1, mid equals lo and the loop never ends.",
    "Computing mid as (lo + hi) / 2 in C++ or Java, which can overflow when both are large. Write lo + (hi − lo) / 2.",
    "Returning on the first match when the problem wants the first or last copy. Keep narrowing instead.",
    "On the answer, starting hi too low so the true answer is outside the range, or counting the check in 32 bits.",
    "Using binary search when the condition isn't one-way, like a peak search that reads a single side without comparing neighbours.",
  ],

  notThis: [
    "Unsorted data and a single lookup: a hash set is O(1) and needs no sort.",
    "A pair with a target sum in sorted data: two pointers is O(n) for all pairs, cheaper than a binary search per element.",
    "The check isn't one-way as the guess grows (adding an item can make it pass, then fail): use DP or try every value.",
  ],

  ladder: [
    { slug: "binary-search", tier: "warm-up", note: "Find x or report −1: the loop in its simplest form." },
    { slug: "search-insert-position", tier: "warm-up", note: "The template: first index with nums[i] >= target." },
    { slug: "sqrtx", tier: "warm-up", note: "Search on values: the last k with k × k <= x, in 64 bits." },
    { slug: "find-first-and-last-position-of-element-in-sorted-array", tier: "core", note: "Two runs of the template, for target and target + 1." },
    { slug: "search-a-2d-matrix", tier: "core", note: "Treat the matrix as one sorted list: index i is row i / n, column i % n." },
    { slug: "find-minimum-in-rotated-sorted-array", tier: "core", note: "The question compares with the last element instead of a target." },
    { slug: "search-in-rotated-sorted-array", tier: "core", note: "Work out which half is sorted, then check whether the target is in it." },
    { slug: "find-peak-element", tier: "core", note: "Unsorted, but nums[mid] < nums[mid + 1] still tells you a peak is to the right." },
    { slug: "koko-eating-bananas", tier: "core", note: "Binary search on the answer: the slowest speed that finishes in time." },
    { slug: "capacity-to-ship-packages-within-d-days", tier: "core", note: "On the answer again, from max(weights) up to sum(weights), with a greedy check." },
    { slug: "split-array-largest-sum", tier: "stretch", note: "The same check as shipping, in a problem that hides it well." },
    { slug: "median-of-two-sorted-arrays", tier: "stretch", note: "Binary search on where to cut the shorter array so both halves balance." },
  ],
};
