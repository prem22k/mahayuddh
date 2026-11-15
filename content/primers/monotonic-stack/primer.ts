import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "monotonic-stack",
  pattern: "Monotonic Stack",
  title: "Monotonic Stack",
  order: 7,
  prerequisites: ["stack"],
  summary:
    "A stack of indices whose values stay sorted, used to find, for every element, the nearest bigger or smaller element to its left or right. One pass answers all n questions in O(n) total.",

  recognizeWhen: [
    "For every element you need the next (or previous) greater or smaller element, or the distance to it.",
    "The brute force is, for each i, scanning right until something beats it, which is O(n²) on sorted input.",
    "Each bar or value matters only until something bigger (or smaller) comes along and blocks it: temperatures, stock spans, people in a queue who can see each other.",
    "You want the widest range in which an element is the minimum (or maximum): histogram rectangles, sums of subarray minimums.",
  ],

  coreIdea: `Scan left to right and keep a stack of indices that are still waiting for their answer. For "next warmer day", their temperatures never rise from the bottom of the stack to the top. When a new day i arrives, it is warmer than every colder day on top, and it is the first such day those days have seen. So pop each of them and record i as its answer. Then push i, which now waits too.

The order on the stack is what makes this work. If the top isn't colder than today, nothing below it is either, because the stack only gets warmer as you go down. So you stop at the first non-colder top, and you never look deeper than you have to.

It's correct because a day is popped exactly when the first warmer day appears. Every day between them was not warmer, or it would have popped this one sooner. It's O(n) even with a while loop inside the for loop, because each index is pushed once and popped at most once. That's 2n operations in total.

Pick the comparison from the question. Next greater: pop while the top is smaller. Next smaller: pop while the top is bigger. Previous greater or smaller: read the top after popping, because it's the nearest survivor to the left. With equal values, decide whether equal counts as \"greater\" and use < or <= to match. Getting this wrong is the most common bug.

The pattern doesn't fit questions about a range that moves, like the max of each window of size k. Old indices also have to leave from the bottom then, so use a monotonic deque (Sliding Window).`,

  walkthrough: {
    problemSlug: "daily-temperatures",
    input: "temperatures = [73, 74, 75, 71, 69, 72, 76, 73]",
    intro: "one step per day. The stack shows temperatures, but it holds their indices.",
    columns: ["Stack (bottom to top)", "What happened", "Answer so far"],
    steps: [
      { window: "73", action: "nothing to pop; push day 0", best: "[·,·,·,·,·,·,·,·]" },
      { window: "74", action: "74 > 73: pop day 0 (1 day); push", best: "[1,·,·,·,·,·,·,·]" },
      { window: "75", action: "75 > 74: pop day 1 (1 day); push", best: "[1,1,·,·,·,·,·,·]" },
      { window: "75 71", action: "71 is colder than 75; push", best: "[1,1,·,·,·,·,·,·]" },
      { window: "75 71 69", action: "69 is colder than 71; push", best: "[1,1,·,·,·,·,·,·]" },
      { window: "75 72", action: "72 pops day 4 (1 day) and day 3 (2 days); stops at 75; push", best: "[1,1,·,2,1,·,·,·]" },
      { window: "76", action: "76 pops day 5 (1 day) and day 2 (4 days); push", best: "[1,1,4,2,1,1,·,·]" },
      { window: "76 73", action: "73 is colder than 76; push", best: "[1,1,4,2,1,1,·,·]" },
    ],
    result: "[1, 1, 4, 2, 1, 1, 0, 0]. Days 6 and 7 are still on the stack at the end, so they never get a warmer day and keep 0.",
  },

  template: {
    code: "daily-temperatures",
    note: "For each i: pop while the top loses to i and answer it, then push i. Change the comparison for greater or smaller, and read the top after popping when you want the previous element instead of the next.",
  },

  variants: [
    {
      name: "Circular array",
      when: "The array wraps around, so the next greater element can be before i.",
      idea: "Loop i from 0 to 2n − 1 and use nums[i % n]. Push indices only on the first lap; the second lap only pops, so elements near the end can find answers near the start.",
      code: "circular-next-greater",
      problemSlug: "next-greater-element-ii",
    },
    {
      name: "Both neighbours at once: widest span",
      when: "Each element's answer depends on how far it can stretch left and right before hitting something smaller.",
      idea:
        "Keep heights rising up the stack. When bar i is not taller than the top, pop it: i is its first smaller bar on the right, and the new top is its first smaller bar on the left. The width is i − left − 1. A final bar of height 0 empties the stack.",
      code: "largest-rectangle",
      problemSlug: "largest-rectangle-in-histogram",
    },
    {
      name: "Greedy removal",
      when: "You build the smallest (or largest) sequence by deleting up to k items, keeping the order.",
      idea:
        "A bigger digit just before a smaller one should go. Pop while k > 0 and the top is bigger than the new digit. Any removals left come off the end, then strip leading zeros.",
      code: "remove-k-digits",
      problemSlug: "remove-k-digits",
    },
  ],

  complexity: {
    time: "O(n), or O(2n) for the circular version",
    space: "O(n) for the stack and the answers",
    why: "Each index is pushed once and popped at most once, so all the inner while loops together do at most n pops. The circular version pushes n times and scans 2n positions.",
  },

  mistakes: [
    "Pushing values when the answer needs a distance or a position. Push indices and read values through them.",
    "Using < where you need <= (or the reverse), which gets equal values wrong. Test with ties, like [70, 70, 71].",
    "Forgetting what's left on the stack at the end. Those elements never found an answer, so give them the default (0 or −1), or flush them with a final sentinel.",
    "Reading the left boundary before popping instead of after. The previous smaller element is the new top once the current one is gone.",
    "In the circular version, pushing indices on both laps, which can put an element on the stack twice.",
    "In Remove K Digits, forgetting the removals still owed after the scan, or the leading zeros (\"10200\", k = 1 gives \"200\").",
  ],

  notThis: [
    "You need the max or min of every window of size k: a monotonic deque, since old indices must leave from the front (Sliding Window).",
    "You only need the single largest or smallest value overall: one pass with a variable, no stack.",
    "Questions about the k largest values, not the nearest larger one: use a heap.",
  ],

  ladder: [
    { slug: "next-greater-element-i", tier: "warm-up", note: "Next greater for every value, stored in a map for lookups." },
    { slug: "final-prices-with-a-special-discount-in-a-shop", tier: "warm-up", note: "Next smaller or equal to the right: the comparison flips." },
    { slug: "daily-temperatures", tier: "core", note: "The template, with distances instead of values." },
    { slug: "next-greater-element-ii", tier: "core", note: "Circular: two laps, pushing only on the first." },
    { slug: "online-stock-span", tier: "core", note: "Previous greater, one call at a time: keep (price, span) pairs on the stack." },
    { slug: "car-fleet", tier: "core", note: "Sort by position, then keep a stack of arrival times that only grows." },
    { slug: "remove-k-digits", tier: "core", note: "Greedy removal while the stack stays non-decreasing." },
    { slug: "132-pattern", tier: "core", note: "Scan right to left, tracking the largest popped value as the \"2\"." },
    { slug: "sum-of-subarray-minimums", tier: "core", note: "Each element's span on both sides, with < on one side and <= on the other so ties count once." },
    { slug: "largest-rectangle-in-histogram", tier: "stretch", note: "Left and right boundaries in one pass, plus a sentinel bar." },
    { slug: "maximal-rectangle", tier: "stretch", note: "Build a histogram per row, then run the histogram solution." },
    { slug: "number-of-visible-people-in-a-queue", tier: "stretch", note: "Count how many shorter people each person pops, plus the one who blocks them." },
  ],
};
