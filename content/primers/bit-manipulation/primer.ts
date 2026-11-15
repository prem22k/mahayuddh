import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "bit-manipulation",
  pattern: "Bit Manipulation",
  title: "Bit Manipulation",
  order: 23,
  prerequisites: ["arrays-hashing"],
  summary:
    "Treat a number as a row of 32 bits and work on all of them at once. XOR cancels pairs, n & (n − 1) removes the lowest 1, and an integer from 0 to 2^n − 1 can stand for a subset of n items.",

  recognizeWhen: [
    "Every number appears twice (or three times) except one or two, and you need O(1) extra space.",
    "The question is about the binary form itself: count the 1 bits, reverse them, check for a power of two.",
    "You must add, swap or compare without the usual operators, or without extra memory.",
    "n is small (up to about 20) and you need to try every subset, or track a set of up to 26 letters or 32 flags as one number.",
  ],

  coreIdea: `A 32-bit int is 32 yes-or-no flags. Bitwise operators work on all of them at the same time, in O(1). & keeps a bit only if both sides have it, | keeps it if either side does, ^ keeps it if exactly one side does, and << and >> shift the whole row. Bit i of x is (x >> i) & 1. To set it, use x | (1 << i). To clear it, use x & ~(1 << i).

XOR is the workhorse. x ^ x = 0, x ^ 0 = x, and the order doesn't matter. XOR a whole array together and every pair cancels, whatever order the pair comes in, so only the unpaired value is left. That's one pass and one variable. It's correct because XOR works bit by bit: a bit is 1 at the end only if an odd number of values had it.

Two more tricks come up again and again. n & (n − 1) clears the lowest 1 bit, because subtracting 1 flips that bit and every 0 below it. So the loop runs once per 1 bit, and n is a power of two when n > 0 and n & (n − 1) == 0. n & −n keeps only the lowest 1 bit, which is the easy way to find one place where two numbers differ.

A mask from 0 to 2^n − 1 can stand for a subset: bit i set means item i is in it. Looping over every mask lists all 2^n subsets with no recursion, in O(n · 2^n).

Watch the edges. In C++, shifting into or past the sign bit of a signed int is undefined, so use unsigned. Java has >>> for a shift that ignores the sign. Python ints have no fixed width, so a negative number has endless 1s; mask with & 0xFFFFFFFF to see the 32-bit pattern.`,

  walkthrough: {
    problemSlug: "single-number",
    input: "nums = [4, 1, 2, 1, 2]",
    intro: "one step per number XORed into acc, which starts at 0.",
    columns: ["acc in binary", "What happened", "acc"],
    steps: [
      { window: "100", action: "0 ^ 4: the 4 bit turns on", best: "4" },
      { window: "101", action: "^ 1: the 1 bit turns on", best: "5" },
      { window: "111", action: "^ 2: the 2 bit turns on", best: "7" },
      { window: "110", action: "^ 1: the second 1 turns the 1 bit back off", best: "6" },
      { window: "100", action: "^ 2: the second 2 turns the 2 bit back off", best: "4" },
    ],
    result: "4. Both pairs cancelled even though they weren't next to each other, and only the bits of the single number were left.",
  },

  template: {
    code: "single-number",
    note: "Fold the whole array with ^. Anything that appears an even number of times disappears. Missing Number is the same trick with the indexes 0 to n XORed in too.",
  },

  variants: [
    {
      name: "Clear the lowest 1: n & (n − 1)",
      when: "You count 1 bits, test for a power of two, or build bit counts for 0 to n.",
      idea:
        "Each n &= n − 1 removes one 1 bit, so the loop runs once per 1, not 32 times. In Python, mask with 0xFFFFFFFF first, or a negative number never reaches 0.",
      code: "count-bits",
      problemSlug: "number-of-1-bits",
    },
    {
      name: "Split by one differing bit",
      when: "Two numbers appear once and everything else twice.",
      idea:
        "XOR everything to get a ^ b. Its lowest 1 bit, from x & −x, is a place where a and b differ. XOR again, using only the numbers with that bit set: pairs still cancel, and you get a. Then b = (a ^ b) ^ a.",
      code: "two-singles",
      problemSlug: "single-number-iii",
    },
    {
      name: "Subsets as bitmasks",
      when: "n is small and you need to check every subset.",
      idea:
        "Loop mask from 1 to 2^n − 1 (0 would be the empty subset). Item i is in the subset when (mask >> i) & 1 is 1. No recursion and no list to undo.",
      code: "subset-masks",
      problemSlug: "count-number-of-maximum-bitwise-or-subsets",
    },
  ],

  complexity: {
    time: "O(n) for XOR folds; O(number of 1 bits) for n & (n − 1); O(n · 2^n) to try every subset",
    space: "O(1), apart from the input",
    why: "Each bitwise operation touches all 32 bits at once in O(1). XOR folds do one pass. The n & (n − 1) loop stops after one step per 1 bit. There are 2^n masks, and each one checks n bits to build its subset.",
  },

  mistakes: [
    "Forgetting precedence: in C++ and Java, x & 1 == 0 means x & (1 == 0). Always put brackets around bit tests.",
    "Shifting 1 << 31 or more on a signed int in C++. Use 1u or 1LL, or unsigned types.",
    "Using >> on a negative Java int and expecting 0s to come in from the left. That's >>>.",
    "Looping while n != 0 on a negative Python int. It never ends; mask with & 0xFFFFFFFF first.",
    "Starting the mask loop at 0 when the question wants non-empty subsets.",
    "Using x & −x on INT_MIN in C++ with a signed int. −INT_MIN overflows; do it on unsigned.",
    "Reaching for XOR when values appear three times. Pairs cancel and triples don't; count each bit mod 3 instead.",
  ],

  notThis: [
    "Duplicates aren't in neat pairs, or you need the counts themselves: a hash map is clearer and still O(n).",
    "n is bigger than about 20, so 2^n subsets is too many: look for DP over sums, or backtracking with pruning.",
    "You need to list subsets in a particular order or with pruning: recursive backtracking is easier to control than a mask loop.",
  ],

  ladder: [
    { slug: "single-number", tier: "warm-up", note: "The template: XOR everything, and pairs cancel." },
    { slug: "number-of-1-bits", tier: "warm-up", note: "n & (n − 1) clears one 1 bit per step." },
    { slug: "power-of-two", tier: "warm-up", note: "One 1 bit: n > 0 and n & (n − 1) == 0." },
    { slug: "missing-number", tier: "warm-up", note: "XOR the values with the indexes 0 to n; only the missing one is left unpaired." },
    { slug: "counting-bits", tier: "core", note: "DP over bits: bits[i] = bits[i & (i − 1)] + 1." },
    { slug: "reverse-bits", tier: "core", note: "Take the low bit, shift it into the answer, 32 times. Watch the sign bit." },
    { slug: "single-number-iii", tier: "core", note: "Two singles: split the array on one bit where they differ." },
    { slug: "single-number-ii", tier: "core", note: "Triples don't cancel with XOR. Count each of the 32 bits mod 3." },
    { slug: "count-number-of-maximum-bitwise-or-subsets", tier: "core", note: "Every subset as a mask from 1 to 2^n − 1." },
    { slug: "maximum-length-of-a-concatenated-string-with-unique-characters", tier: "core", note: "A 26-bit mask per word: two words clash when their masks share a bit." },
    { slug: "sum-of-two-integers", tier: "core", note: "Add with ^ for the sum and & then << for the carry, until no carry is left." },
    { slug: "find-the-longest-substring-containing-vowels-in-even-counts", tier: "stretch", note: "A 5-bit mask of vowel parities, with Prefix Sum's first-index map on top." },
    { slug: "maximum-xor-of-two-numbers-in-an-array", tier: "stretch", note: "Build the answer from the top bit down, using a set of prefixes or a bit trie." },
    { slug: "shortest-path-visiting-all-nodes", tier: "stretch", note: "BFS where the state is (node, mask of visited nodes)." },
  ],
};
