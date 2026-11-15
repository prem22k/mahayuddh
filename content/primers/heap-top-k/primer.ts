import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "heap-top-k",
  pattern: "Heap (Priority Queue)",
  title: "Heap / Top-K",
  order: 10,
  prerequisites: ["arrays-hashing"],
  summary:
    "For questions about the k largest, smallest, most frequent or closest items, or the smallest of several sorted streams. A heap capped at k keeps the best k seen so far, so you never sort everything.",

  recognizeWhen: [
    "The question says k: kth largest, top k frequent, k closest, k smallest pairs.",
    "You repeatedly need the current smallest or largest item while items keep being added.",
    "Several sorted lists or streams must be combined in order.",
    "Sorting everything would work, but k is much smaller than n, or the data arrives as a stream.",
  ],

  coreIdea: `A heap is a tree kept in an array where every parent is smaller than its children (a min-heap). The smallest item is always at the root. Push and pop both cost O(log size), and reading the root is O(1). Nothing else is ordered, so it's cheaper to keep than a sorted list.

For the k largest items, keep a min-heap of at most k items. Push each new item; if the heap grows to k + 1, pop the root. The invariant: after each step, the heap holds the k largest items seen so far. The root is the smallest of them, which is exactly the kth largest. It flips for the k smallest: keep a max-heap and evict the largest.

Why it's correct: the popped item is smaller than k others already seen, so it can never be among the k largest. Why it's fast: the heap never holds more than k + 1 items, so each step is O(log k), and the whole pass is O(n log k) with O(k) memory. That beats sorting when k is small, and it works on a stream you can't store.

The same tool merges k sorted lists. Put the first item of each list in a min-heap. Pop the smallest, then push the next item from the list it came from. The heap only ever holds one item per list.

It's the wrong tool when you need the items in a range, or the median of a window that slides (you can't delete from the middle of a heap cheaply). If you need all of the top k sorted, pop them at the end.`,

  walkthrough: {
    problemSlug: "kth-largest-element-in-an-array",
    input: "nums = [3,2,1,5,6,4], k = 2",
    intro: "one step per number pushed.",
    columns: ["Heap (smallest first)", "What happened", "kth largest so far"],
    steps: [
      { window: "{3}", action: "push 3", best: "fewer than k items" },
      { window: "{2, 3}", action: "push 2", best: "2" },
      { window: "{2, 3}", action: "push 1 → 3 items; pop the root 1", best: "2" },
      { window: "{3, 5}", action: "push 5 → 3 items; pop the root 2", best: "3" },
      { window: "{5, 6}", action: "push 6 → 3 items; pop the root 3", best: "5" },
      { window: "{5, 6}", action: "push 4 → 3 items; pop the root 4", best: "5" },
    ],
    result: "5, the root of the heap holding the two largest values {5, 6}",
  },

  template: {
    code: "kth-largest",
    note: "Push, then pop if the heap holds more than k. Use a min-heap for the k largest and a max-heap for the k smallest: the root is always the one about to be evicted.",
  },

  variants: [
    {
      name: "Top k by a score",
      when: "You rank items by something you compute first: a frequency, a count, a cost.",
      idea:
        "Count with a hash map, then run the template on (score, item) pairs. The heap compares the score first, so the item only breaks ties.",
      code: "top-k-frequent",
      problemSlug: "top-k-frequent-elements",
    },
    {
      name: "k smallest: flip to a max-heap",
      when: "You want the k closest, cheapest or smallest items.",
      idea:
        "Keep a max-heap of size k so the worst of the current k sits on top and is the one evicted. In Python, heapq is min-only, so push the negated distance.",
      code: "k-closest",
      problemSlug: "k-closest-points-to-origin",
    },
    {
      name: "K-way merge",
      when: "k lists are each sorted and you need them merged, or the kth smallest across them.",
      idea:
        "Seed a min-heap with the head of each list, as (value, list index). Pop the smallest, append it, and push the next node from the same list. The heap never holds more than k entries.",
      code: "merge-k-lists",
      problemSlug: "merge-k-sorted-lists",
    },
  ],

  complexity: {
    time: "O(n log k)",
    space: "O(k)",
    why: "Each of the n items is pushed once and popped at most once, and the heap never holds more than k + 1 items, so every operation is O(log k). The k-way merge is the same: N total nodes, each pushed and popped once, in a heap of at most k entries. The top-k-frequent variant adds an O(n) counting pass and O(d) map space for d distinct values.",
  },

  mistakes: [
    "Using a max-heap for the k largest. Then the root is the biggest, and popping it throws away the answer.",
    "Letting the heap grow to n and popping k times at the end. It's correct but O(n log n), not O(n log k).",
    "Forgetting that Python's heapq is a min-heap only. For a max-heap, push −value and negate again when you read it.",
    "Pushing objects that can't be compared. In Python, put a tiebreaker such as an index before the node in the tuple.",
    "Comparing with a − b in a Java comparator. It overflows on large values; use Integer.compare.",
    "Expecting the heap's array to be sorted. Only the root is guaranteed; pop repeatedly to get sorted order.",
    "Getting the tie order wrong when the problem specifies one (top k frequent words breaks ties alphabetically).",
  ],

  notThis: [
    "You need the kth largest once and can modify the array: quickselect is O(n) on average. Mention it, then use the heap if worst-case time matters.",
    "The max or min of a sliding window of fixed size: a monotonic deque is O(n). See Sliding Window.",
    "Values are small integers or frequencies are bounded by n: bucket sort by count gives top k in O(n).",
    "You need to remove arbitrary items or query ranges: use a balanced tree or a sorted container instead.",
  ],

  ladder: [
    { slug: "last-stone-weight", tier: "warm-up", note: "A max-heap you pop twice and push once. Get used to the API." },
    { slug: "kth-largest-element-in-a-stream", tier: "warm-up", note: "The template kept alive between calls: a min-heap capped at k." },
    { slug: "kth-largest-element-in-an-array", tier: "core", note: "The template on a fixed array. Compare it with sorting and quickselect." },
    { slug: "top-k-frequent-elements", tier: "core", note: "Count first, then keep the k most frequent." },
    { slug: "k-closest-points-to-origin", tier: "core", note: "k smallest: flip to a max-heap so the worst is on top." },
    { slug: "sort-characters-by-frequency", tier: "core", note: "Pop everything by frequency: the heap as a sorter." },
    { slug: "top-k-frequent-words", tier: "core", note: "Ties matter: frequency first, then alphabetical, and the comparator must agree." },
    { slug: "kth-smallest-element-in-a-sorted-matrix", tier: "core", note: "K-way merge over the rows, stopping at the kth pop." },
    { slug: "find-k-pairs-with-smallest-sums", tier: "core", note: "Lazy expansion: push a pair's neighbour only when that pair is popped." },
    { slug: "reorganize-string", tier: "core", note: "Greedy with a heap: place the most common letter that isn't the one you just placed." },
    { slug: "merge-k-sorted-lists", tier: "stretch", note: "K-way merge on linked lists: one head per list in the heap." },
    { slug: "find-median-from-data-stream", tier: "stretch", note: "Two heaps: a max-heap for the lower half, a min-heap for the upper half, kept balanced." },
    { slug: "ipo", tier: "stretch", note: "Two heaps over time: unlock projects by capital, then take the most profitable one." },
  ],
};
