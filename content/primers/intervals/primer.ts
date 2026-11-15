import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "intervals",
  pattern: "Sorting",
  title: "Intervals",
  order: 9,
  prerequisites: ["prefix-sum", "two-pointers"],
  summary:
    "For problems about ranges with a start and an end: meetings, bookings, time slots. Sort them so that overlapping ranges sit next to each other, then merge, insert or count in one pass.",

  recognizeWhen: [
    "The input is a list of [start, end] pairs: meetings, bookings, balloons, trips.",
    "The question says overlap, merge, conflict, free time, or how many at once.",
    "Comparing every pair would work, but n is large enough that O(n²) is too slow.",
    "The answer depends on the order of events in time, not on the order the intervals were given in.",
  ],

  coreIdea: `Two intervals [a, b] and [c, d] overlap when each one starts before the other ends: a ≤ d and c ≤ b. Checking that for every pair is O(n²). Sorting by start removes most of the pairs from consideration.

After sorting by start, keep the merged blocks in a list. For each new interval, only the last block can overlap it. Every earlier block ended before the last block began, and the new interval starts even later. So one comparison per interval is enough: if it starts after the last block's end, it begins a new block; otherwise it joins the last block, whose end becomes the larger of the two ends.

That's why the sort is the whole cost: O(n log n) to sort, then O(n) for the pass. If the input is already sorted, as in insert interval, you skip the sort and the pass alone is O(n).

For "how many overlap at once", stop thinking about intervals and think about events. Each interval adds +1 at its start and −1 when it ends. Sort the events by time and keep a running total; its peak is the answer. That is the sweep line. Ties matter: decide whether an interval ending at time t and another starting at t overlap, and order the events to match.

Sorting by start doesn't fit every interval question. To keep as many non-overlapping intervals as possible, sort by end instead. That's a greedy choice with its own proof (see Greedy).`,

  walkthrough: {
    problemSlug: "merge-intervals",
    input: "intervals = [[2,3],[1,5],[6,8],[7,7]]",
    intro: "one step per interval, after the sort.",
    columns: ["Interval", "What happened", "Merged so far"],
    steps: [
      { window: "[1,5] [2,3] [6,8] [7,7]", action: "sort by start", best: "(empty)" },
      { window: "[1,5]", action: "nothing merged yet: start a block", best: "[1,5]" },
      { window: "[2,3]", action: "2 ≤ 5, overlaps: end = max(5, 3) = 5", best: "[1,5]" },
      { window: "[6,8]", action: "6 > 5: start a new block", best: "[1,5] [6,8]" },
      { window: "[7,7]", action: "7 ≤ 8, overlaps: end = max(8, 7) = 8", best: "[1,5] [6,8]" },
    ],
    result: "[[1,5],[6,8]]. Setting end = 3 instead of max(5, 3) at the second step would have split [1,5] wrongly.",
  },

  template: {
    code: "merge-intervals",
    note: "Sort by start, then for each interval either start a new block or extend the last one. Always take the max of the two ends: an interval can sit entirely inside the block.",
  },

  variants: [
    {
      name: "Insert into a sorted list",
      when: "The intervals are already sorted and disjoint, and one new interval arrives.",
      idea:
        "No sort. Three loops: copy everything that ends before the new interval starts, absorb everything that starts before it ends (stretching its start and end), then copy the rest.",
      code: "insert-interval",
      problemSlug: "insert-interval",
    },
    {
      name: "Sweep line: the most at once",
      when: "You need the peak number of overlapping intervals: rooms, groups, cars, people alive in a year.",
      idea:
        "Turn each interval into a +1 event at its start and a −1 event where it stops. Sort the events and keep a running sum; the answer is its peak. Here the ends are inclusive, so the −1 goes at right + 1, and at equal times the −1 sorts first.",
      code: "sweep-line",
      problemSlug: "divide-intervals-into-minimum-number-of-groups",
    },
    {
      name: "Two sorted lists",
      when: "You get two lists, each sorted and disjoint, and need where they overlap.",
      idea:
        "Walk both lists with two pointers. The overlap of the current pair is [max of starts, min of ends], if that's not empty. Then move past whichever interval ends first: it can't overlap anything later in the other list.",
      code: "intersections",
      problemSlug: "interval-list-intersections",
    },
  ],

  complexity: {
    time: "O(n log n), or O(n) if the input is already sorted",
    space: "O(n) for the output or the event list",
    why: "The sort dominates. After it, each interval is looked at once, and each comparison is only against the last merged block. The sweep line sorts 2n events, which is still O(n log n). The two-list walk moves one pointer every step, so it ends within len(a) + len(b) steps.",
  },

  mistakes: [
    "Setting the merged end to the new interval's end instead of the max of both. [1,10] then [2,3] must stay [1,10].",
    "Getting the touch case wrong. Read whether [1,4] and [4,5] overlap in this problem, and use < or ≤ to match.",
    "Sorting by start when the question is about keeping or removing the most intervals. That needs sort by end.",
    "In the sweep line, letting a start come before an end at the same time when they shouldn't overlap. Sort the tie on purpose.",
    "In Java, sorting with (a, b) -> a[0] - b[0]. It overflows for large negative and positive values; use Integer.compare.",
    "Comparing the new interval with the first merged block instead of the last one.",
  ],

  notThis: [
    "Keep the most non-overlapping intervals, or remove the fewest: sort by end and take greedily. See Greedy.",
    "Many point queries (how many intervals cover time t?): sort starts and ends separately and binary search, or build a difference array if the range is small.",
    "Intervals keep arriving and you need the current overlap each time: a sorted map or a heap of end times, not a full re-sort.",
  ],

  ladder: [
    { slug: "determine-if-two-events-have-conflict", tier: "warm-up", note: "The overlap test on its own: each starts before the other ends." },
    { slug: "teemo-attacking", tier: "warm-up", note: "Merging on the fly when the intervals arrive already sorted." },
    { slug: "maximum-population-year", tier: "warm-up", note: "A tiny sweep line: +1 at birth, −1 at death, find the peak." },
    { slug: "merge-intervals", tier: "core", note: "The template: sort by start, then extend or append." },
    { slug: "insert-interval", tier: "core", note: "Already sorted, so three phases and no sort." },
    { slug: "count-days-without-meetings", tier: "core", note: "Merge first, then count the gaps between blocks." },
    { slug: "remove-covered-intervals", tier: "core", note: "Break start ties by longer first, then track the furthest end." },
    { slug: "interval-list-intersections", tier: "core", note: "Two sorted lists walked with two pointers." },
    { slug: "divide-intervals-into-minimum-number-of-groups", tier: "core", note: "The sweep line peak. This is Meeting Rooms II without the paywall." },
    { slug: "car-pooling", tier: "core", note: "The same sweep with weights: add passengers at pickup, remove them at drop-off." },
    { slug: "my-calendar-i", tier: "core", note: "Intervals arrive one at a time: test each against what's booked." },
    { slug: "number-of-flowers-in-full-bloom", tier: "stretch", note: "Many point queries: sorted starts and ends plus binary search." },
    { slug: "minimum-interval-to-include-each-query", tier: "stretch", note: "Sort the queries too, and keep the open intervals in a heap." },
    { slug: "the-skyline-problem", tier: "stretch", note: "A sweep line where the state is a max-heap of live heights." },
  ],
};
