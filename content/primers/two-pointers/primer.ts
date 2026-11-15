import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "two-pointers",
  pattern: "Two Pointers",
  title: "Two Pointers",
  order: 3,
  prerequisites: ["arrays-hashing"],
  summary:
    "Two indices move through the array in a planned way, either inward from both ends of sorted data or forward together as a reader and a writer. Each step rules out a whole row of candidates, so a search over pairs takes O(n) instead of O(n²).",

  recognizeWhen: [
    "The array is sorted (or you're allowed to sort it) and you're looking for a pair or triplet with a target sum, difference or product.",
    "You compare or swap things from both ends: palindromes, reversing, squares of a sorted array.",
    "You have to filter or compact an array in place with O(1) extra space: remove duplicates, move zeroes, keep only valid items.",
    "The brute force tries every pair (i, j), and there's an order that tells you which side to give up on.",
  ],

  coreIdea: `Put left at the start and right at the end of a sorted array, and look at the pair they point to. If the sum is too small, numbers[left] is too small even with the largest partner still available, so no answer uses it: move left forward. If the sum is too big, numbers[right] is too big even with the smallest partner: move right back. If it matches, you're done.

The invariant is that any answer still lies between left and right. Each move removes one element together with every pair it could have formed, and sorted order is what proves none of those pairs worked. Without sorting, the same move would throw away pairs you never checked.

Every step moves one pointer one place, and they start n − 1 apart, so the loop runs at most n − 1 times. That's O(n) after an O(n log n) sort, against O(n²) for checking every pair.

The second shape is two pointers going the same way. read scans every element, and write marks where the next kept element goes. Everything before write is the finished part of the answer. It's how you filter in place in one pass. Fast and slow pointers on a linked list are the same idea, and the Linked List primer covers them.

It breaks when the order gives you no rule for which pointer to move. Unsorted input where you need the original indices is the usual case: use a hash map then.`,

  walkthrough: {
    problemSlug: "two-sum-ii-input-array-is-sorted",
    input: "numbers = [1, 3, 4, 6, 8, 11], target = 10",
    intro: "one step per comparison.",
    columns: ["Pointers", "Check", "Answer"],
    steps: [
      { window: "[1] 3 4 6 8 [11]", action: "1 + 11 = 12, too big: right − 1", best: "none" },
      { window: "[1] 3 4 6 [8] 11", action: "1 + 8 = 9, too small: left + 1", best: "none" },
      { window: "1 [3] 4 6 [8] 11", action: "3 + 8 = 11, too big: right − 1", best: "none" },
      { window: "1 [3] 4 [6] 8 11", action: "3 + 6 = 9, too small: left + 1", best: "none" },
      { window: "1 3 [4] [6] 8 11", action: "4 + 6 = 10, found", best: "[3, 4]" },
    ],
    result: "[3, 4] in 1-based indices. Five checks instead of the 15 pairs a nested loop would try.",
  },

  template: {
    code: "two-sum-sorted",
    note: "Compare, then move the pointer whose element can't be part of any answer. The ladder changes what is compared and what \"too small\" means, not the shape.",
  },

  variants: [
    {
      name: "Read and write, same direction",
      when: "You must filter or compact an array in place.",
      idea: "read visits every element; write only moves when you keep one. Everything before write is the answer so far, and the function returns write as the new length.",
      code: "remove-duplicates",
      problemSlug: "remove-duplicates-from-sorted-array",
    },
    {
      name: "Fix one, two-pointer the rest",
      when: "You need triplets (or quadruplets) with a target sum.",
      idea:
        "Sort. For each i, run the template on i + 1..n − 1 looking for −nums[i]. Skip a first value equal to the one before it, and after a match skip equal values on the left, so no triplet repeats.",
      code: "three-sum",
      problemSlug: "3sum",
    },
    {
      name: "Move the side that limits you",
      when: "You maximise something that depends on the shorter of two ends and the distance between them.",
      idea:
        "The area is min(height) × width. Pairing the shorter wall with anything closer can only lose width without gaining height, so it's finished: move it inward.",
      code: "most-water",
      problemSlug: "container-with-most-water",
    },
  ],

  complexity: {
    time: "O(n) per scan; O(n log n) if you sort first; O(n²) for 3Sum",
    space: "O(1) extra, apart from the sort and the output",
    why: "The two pointers start n − 1 apart and every step closes the gap by one, so a scan is at most n steps. 3Sum runs one O(n) scan for each of n first values.",
  },

  mistakes: [
    "Using left <= right for pairs, which lets an element pair with itself.",
    "Running opposite-end pointers on an unsorted array. The move rule depends on sorted order.",
    "Sorting when the problem wants original indices. Sorting loses them, so use a hash map or sort (value, index) pairs.",
    "In 3Sum, not skipping duplicates, which reports the same triplet more than once. Skip at the first value and after each match.",
    "Moving the taller wall in Container With Most Water. It can never help, and you can skip the real answer.",
    "Returning 0-based indices when the problem asks for 1-based (Two Sum II).",
  ],

  notThis: [
    "Unsorted input and you need the original indices of a pair: a hash map of value → index (Arrays & Hashing).",
    "The answer is a contiguous stretch that grows and shrinks, like the longest substring without repeats: that's a sliding window.",
    "You're searching for one value or boundary in sorted data, not a pair: binary search is O(log n).",
  ],

  ladder: [
    { slug: "reverse-string", tier: "warm-up", note: "Swap from both ends until the pointers meet." },
    { slug: "valid-palindrome", tier: "warm-up", note: "Compare from both ends, skipping characters that don't count." },
    { slug: "merge-sorted-array", tier: "warm-up", note: "Three pointers, filling from the back so nothing gets overwritten." },
    { slug: "two-sum-ii-input-array-is-sorted", tier: "core", note: "The template: too small, move left; too big, move right." },
    { slug: "remove-duplicates-from-sorted-array", tier: "core", note: "Read and write pointers moving the same way." },
    { slug: "move-zeroes", tier: "core", note: "Read and write again, keeping the order of what stays." },
    { slug: "squares-of-a-sorted-array", tier: "core", note: "The biggest square is at one of the two ends: fill the output from the back." },
    { slug: "3sum", tier: "core", note: "Fix one, two-pointer the rest, skip duplicates." },
    { slug: "container-with-most-water", tier: "core", note: "Not a sum: move the shorter wall, and say why that's safe." },
    { slug: "sort-colors", tier: "core", note: "Three pointers split the array into 0s, 1s and 2s in one pass." },
    { slug: "boats-to-save-people", tier: "core", note: "Greedy pairing: the heaviest person takes the lightest one if they fit." },
    { slug: "4sum", tier: "stretch", note: "Two fixed indices plus the template, and sums that overflow 32 bits." },
    { slug: "trapping-rain-water", tier: "stretch", note: "Move the side with the lower wall, keeping the best height seen on each side." },
  ],
};
