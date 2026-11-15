import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "linked-list",
  pattern: "Linked List",
  title: "Linked List",
  order: 8,
  prerequisites: ["two-pointers"],
  summary:
    "For problems that rewire a chain of nodes in place: reverse it, find its middle or its loop, merge two sorted chains, or cut and rejoin pieces. A few named pointers walk the list, and each node is touched a constant number of times.",

  recognizeWhen: [
    "The input is a ListNode head and the answer is a rearranged list: reversed, merged, reordered, with nodes removed.",
    "You need a position you can't index: the middle, the kth node from the end, where a loop starts.",
    "The problem asks for O(1) extra space, so copying the values into an array isn't allowed.",
    "Two sorted lists (or k of them) have to become one sorted list.",
    "The head itself might be removed or replaced, so you keep writing special cases for it.",
  ],

  coreIdea: `A linked list gives you no indexes, only next pointers. Almost every problem comes down to three moves: walk with two pointers at different speeds, turn links around one at a time, and stitch nodes onto a growing tail. The skill is keeping the right references alive while you change links.

Reversal keeps three pointers. prev is the head of the part already reversed, curr is the node being turned, and nxt saves the rest of the list before curr's link is overwritten. After each step, everything before curr points backwards and everything from curr on is untouched. When curr falls off the end, prev is the new head.

Fast and slow pointers start together; fast moves two nodes per step, slow moves one. When fast reaches the end, slow has gone half as far, so it sits in the middle. If the list loops, fast can never reach the end. Once both are inside the loop, the gap between them shrinks by one node per step, so they must meet within one lap.

Merging uses a dummy node in front of the answer and a tail pointer. Each step links the smaller of the two heads onto the tail. The dummy means the first node isn't a special case, and it handles a head that gets removed. Return dummy.next.

All of this is O(n) time and O(1) space because nodes are relinked, never copied. It breaks down when you need random access, like a binary search over positions. Then copy the values into an array first.`,

  walkthrough: {
    problemSlug: "reverse-linked-list",
    input: "head = [1,2,3,4,5]",
    intro: "one step per pass of the loop.",
    columns: ["Still to turn (curr)", "What happened", "Reversed so far (prev)"],
    steps: [
      { window: "2 → 3 → 4 → 5", action: "save 2; point 1 at null; prev = 1", best: "1" },
      { window: "3 → 4 → 5", action: "save 3; point 2 at 1; prev = 2", best: "2 → 1" },
      { window: "4 → 5", action: "save 4; point 3 at 2; prev = 3", best: "3 → 2 → 1" },
      { window: "5", action: "save 5; point 4 at 3; prev = 4", best: "4 → 3 → 2 → 1" },
      { window: "null", action: "save null; point 5 at 4; prev = 5; curr is null, stop", best: "5 → 4 → 3 → 2 → 1" },
    ],
    result: "[5,4,3,2,1], with prev as the new head",
  },

  template: {
    code: "reverse-list",
    note: "Save, turn, step. Write the three lines in this order every time: if you turn the link before saving next, the rest of the list is lost.",
  },

  variants: [
    {
      name: "Fast and slow: where the loop starts",
      when: "You need the middle of a list, whether it loops, or the first node of the loop.",
      idea:
        "Run fast (two steps) and slow (one step) until they meet. Then move one of them back to head and step both one node at a time; they meet again at the loop's first node. If the part before the loop is a nodes long, the math works out so that a steps forward from the meeting point (maybe after a few full laps) also lands on the loop's start.",
      code: "cycle-start",
      problemSlug: "linked-list-cycle-ii",
    },
    {
      name: "Merge with a dummy head",
      when: "Two sorted lists become one, or you build a new list node by node.",
      idea:
        "Keep a tail pointer that starts at a dummy node. Link the smaller head onto the tail and advance that list. When one list runs out, attach the rest of the other in one step: it's already sorted.",
      code: "merge-sorted",
      problemSlug: "merge-two-sorted-lists",
    },
    {
      name: "Middle, reverse, weave",
      when: "The answer pairs the front of the list with the back: reorder, palindrome check, twin sums.",
      idea:
        "Find the middle with fast and slow, cut the list there, reverse the second half, then walk both halves together. All three moves from this primer in one problem, still in O(1) space.",
      code: "reorder-list",
      problemSlug: "reorder-list",
    },
  ],

  complexity: {
    time: "O(n)",
    space: "O(1)",
    why: "Each pointer only moves forward and each link is rewritten at most once, so every node is touched a constant number of times. Nothing is copied: the answer reuses the input's nodes. In the loop case, slow enters the loop within n steps and fast catches it within one more lap.",
  },

  mistakes: [
    "Overwriting curr.next before saving it. The rest of the list is then unreachable.",
    "Checking fast.next.next without checking fast.next first. Test with lists of length 0, 1 and 2.",
    "Not setting the new tail's next to null after a cut or a reversal, which leaves a loop that hangs any later traversal.",
    "Special-casing the head instead of putting a dummy node in front of it. Removing the first node is where the bugs hide.",
    "Picking the wrong middle for even lengths. Decide whether slow should stop on the first or the second middle, and test [1,2,3,4].",
    "Returning the old head after a reversal. The new head is prev.",
    "Comparing values when you mean nodes. Two different nodes can hold the same value; compare references.",
  ],

  notThis: [
    "You need the kth element many times or a binary search over positions: copy the values into an array.",
    "The question is about values only, not the links (is there a duplicate value?): a hash set over the values is simpler.",
    "Merging k sorted lists at once: pairwise merging works, but a min-heap of the k heads is the standard tool. See Heap / Top-K.",
  ],

  ladder: [
    { slug: "reverse-linked-list", tier: "warm-up", note: "The template: save, turn, step." },
    { slug: "merge-two-sorted-lists", tier: "warm-up", note: "A dummy head and a tail pointer. The merge step of merge sort." },
    { slug: "middle-of-the-linked-list", tier: "warm-up", note: "Fast and slow pointers in their simplest form." },
    { slug: "linked-list-cycle", tier: "warm-up", note: "The same two pointers. If they ever meet, the list loops." },
    { slug: "remove-nth-node-from-end-of-list", tier: "core", note: "Give fast an n-node head start; a dummy covers removing the head." },
    { slug: "linked-list-cycle-ii", tier: "core", note: "Floyd's second phase: reset one pointer to find where the loop starts." },
    { slug: "palindrome-linked-list", tier: "core", note: "Middle, then reverse the second half and compare, in O(1) space." },
    { slug: "reverse-linked-list-ii", tier: "core", note: "Reverse only a stretch, then reconnect both ends of it." },
    { slug: "reorder-list", tier: "core", note: "All three moves in one problem: middle, reverse, weave." },
    { slug: "add-two-numbers", tier: "core", note: "Build a new list behind a dummy head while carrying a digit." },
    { slug: "sort-list", tier: "core", note: "Merge sort on a list: split with fast and slow, merge with a dummy." },
    { slug: "reverse-nodes-in-k-group", tier: "stretch", note: "Reverse k nodes at a time and stitch each group to the next; leave a short tail alone." },
    { slug: "find-the-duplicate-number", tier: "stretch", note: "Floyd's cycle start on an array: treat i → nums[i] as a next pointer." },
  ],
};
