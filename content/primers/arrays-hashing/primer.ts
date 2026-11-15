import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "arrays-hashing",
  pattern: "Hash Table",
  title: "Arrays & Hashing",
  order: 1,
  prerequisites: [],
  summary:
    "Trade memory for speed: keep what you've already seen in a hash map or set, so the question \"have I seen this, and where?\" costs O(1) instead of another scan. It turns most O(n²) pair and duplicate searches into one pass.",

  recognizeWhen: [
    "The brute force is a nested loop that, for each element, searches the rest of the array for a partner, a copy or a match.",
    "The question is about counts or membership: duplicates, anagrams, the most frequent items, whether a value exists.",
    "Things that should be treated as the same need to be grouped: words with the same letters, values with the same remainder, cells in the same row.",
    "Order doesn't matter, or you only need an index back, not a sorted result.",
  ],

  coreIdea: `Walk the array once. For each element, ask the hash map a question about the elements before it, then add the current element to the map. The map is a memory of everything to the left of i, organised so that one lookup answers what a whole inner loop used to.

What you store depends on the question. "Is there a partner?" stores value → index. "How many?" stores value → count. "Which group?" stores key → list, where the key is something every member of the group shares, like a word's sorted letters.

It's fast because a hash lookup takes O(1) time on average, and each element is looked up and inserted once, so the pass is O(n). It's correct because when you reach index i, the map holds exactly the elements at 0..i−1. If the answer pairs i with an earlier index, that earlier element is already in the map, so you can't miss it.

The order matters. Look up first, insert second. If you insert first, an element can find itself: in Two Sum, 4 + 4 = 8 would match a single 4.

It breaks down when you need order: the smallest value above x, everything in a range, the k-th largest. A hash map keeps no order. Use sorting, binary search or a heap there. Hash lookups are O(1) on average, not guaranteed, but interviews treat them as constant.`,

  walkthrough: {
    problemSlug: "two-sum",
    input: "nums = [4, 6, 1, 9, 3, 5], target = 8",
    intro: "one step per index.",
    columns: ["Map (value: index)", "What happened", "Answer"],
    steps: [
      { window: "{4: 0}", action: "4 needs 4: not stored yet; store 4", best: "none" },
      { window: "{4: 0, 6: 1}", action: "6 needs 2: not stored; store 6", best: "none" },
      { window: "{4: 0, 6: 1, 1: 2}", action: "1 needs 7: not stored; store 1", best: "none" },
      { window: "{4: 0, 6: 1, 1: 2, 9: 3}", action: "9 needs −1: not stored; store 9", best: "none" },
      { window: "{…, 9: 3, 3: 4}", action: "3 needs 5: not stored; store 3", best: "none" },
      { window: "{…, 9: 3, 3: 4}", action: "5 needs 3: stored at index 4", best: "[4, 5]" },
    ],
    result: "[4, 5], since 3 + 5 = 8. At step 1 the 4 didn't match itself because the lookup ran before the insert.",
  },

  template: {
    code: "two-sum",
    note: "Look up, then insert. Most problems in this family are this loop with a different thing stored and a different question asked.",
  },

  variants: [
    {
      name: "Count, then compare",
      when: "Two collections must contain the same things the same number of times.",
      idea: "Keep one count map. Add 1 for each letter of s and subtract 1 for each letter of t. They match only if every count ends at zero.",
      code: "anagram-count",
      problemSlug: "valid-anagram",
    },
    {
      name: "Group by a shared key",
      when: "Items that are equivalent in some way have to end up together.",
      idea: "Compute a key that every member of a group shares and no outsider does, here the sorted letters. Map key → list and append each item to its list.",
      code: "group-anagrams",
      problemSlug: "group-anagrams",
    },
    {
      name: "Set for membership",
      when: "You only need to know whether a value exists, for example to walk runs of consecutive numbers.",
      idea:
        "Put everything in a set. Only start counting a run at x when x − 1 is missing, so each run is walked once from its first number and the whole thing stays O(n).",
      code: "longest-consecutive",
      problemSlug: "longest-consecutive-sequence",
    },
  ],

  complexity: {
    time: "O(n) on average",
    space: "O(n) for the map or set",
    why: "Each element is looked up once and inserted once, and each of those takes O(1) on average. In Longest Consecutive Sequence the inner while loop only runs from the start of a run, so across the whole scan it adds up to n steps.",
  },

  mistakes: [
    "Inserting before looking up, so an element pairs with itself (Two Sum with [3, 2, 4], target 6, must not return 3 + 3).",
    "Storing value → index when values repeat, and overwriting the index you needed. Decide whether you want the first or the last index.",
    "Reading a missing key: C++ map[key] silently inserts a zero, and Java's map.get returns null. Use find, count or getOrDefault.",
    "Comparing boxed Integer or Character values with == in Java. It works for small numbers and fails for large ones. Use equals or unbox first.",
    "Using a key that isn't unique to the group, like the set of letters instead of the sorted letters (\"ab\" and \"aab\" share a set).",
    "Starting the inner walk from every element in Longest Consecutive Sequence, which quietly makes it O(n²).",
  ],

  notThis: [
    "The array is sorted and you want a pair: two pointers from both ends finds it in O(1) extra space.",
    "You need the smallest, largest or k-th value, or anything about order: sort, use a heap, or binary search.",
    "The question is about a contiguous subarray's sum: prefix sums, often with a hash map of earlier prefixes, not a plain value map.",
  ],

  ladder: [
    { slug: "contains-duplicate", tier: "warm-up", note: "A set and one question: have I seen this before?" },
    { slug: "valid-anagram", tier: "warm-up", note: "A count map instead of a set." },
    { slug: "two-sum", tier: "warm-up", note: "Value → index: look up the partner, then insert." },
    { slug: "isomorphic-strings", tier: "core", note: "Two maps that must agree both ways: s→t and t→s." },
    { slug: "group-anagrams", tier: "core", note: "The key is computed: sorted letters, or a 26-count tuple." },
    { slug: "top-k-frequent-elements", tier: "core", note: "Count first, then bucket values by their count to avoid sorting." },
    { slug: "valid-sudoku", tier: "core", note: "One set per row, column and box; the box index is a key built from two numbers." },
    { slug: "longest-consecutive-sequence", tier: "core", note: "A set, plus the rule that only the start of a run gets walked." },
    { slug: "find-all-duplicates-in-an-array", tier: "core", note: "Values are 1..n, so the array itself can be the hash table: mark index v − 1." },
    { slug: "insert-delete-getrandom-o1", tier: "core", note: "A map of value → position in an array, and swap-with-last to delete in O(1)." },
    { slug: "first-missing-positive", tier: "stretch", note: "Index-as-hash with O(1) extra space: put each value v at index v − 1." },
    { slug: "max-points-on-a-line", tier: "stretch", note: "The key is a slope, reduced by gcd so that equal slopes hash the same." },
  ],
};
