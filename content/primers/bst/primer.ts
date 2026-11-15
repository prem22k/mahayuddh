import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "bst",
  pattern: "Binary Search Tree",
  title: "Binary Search Tree",
  order: 14,
  prerequisites: ["tree-dfs", "binary-search"],
  summary:
    "For trees where every node is larger than everything on its left and smaller than everything on its right. Comparing with a node tells you which side the answer is on, so you walk one path instead of visiting the whole tree, and an in-order walk gives the values in sorted order.",

  recognizeWhen: [
    "The problem says binary search tree, or the tree is built from sorted data.",
    "You need to find, insert or delete a value, or the place where two values split apart.",
    "The question talks about order: the kth smallest, the next larger value, values in a range.",
    "You must check whether a tree follows the BST rule, or repair one that breaks it.",
  ],

  coreIdea: `A binary search tree keeps one rule at every node: all values in the left subtree are smaller than the node, and all values in the right subtree are larger. The rule is about whole subtrees, not just the two children.

That rule gives two tools. First, a comparison tells you where to go. If the target is smaller than the node, it can only be on the left, so the right subtree is thrown away, like the half you drop in binary search. Search, insert, delete and the split point of two values each walk one root-to-leaf path. Second, an in-order walk (left, node, right) visits the values in sorted order, so "kth smallest" or "is this sorted?" becomes a walk with a counter.

To check the rule, pass an allowed range down the tree. The root may hold anything. Its left child must be below the root, and its right child above it. Each step narrows the range by one bound, so a node deep on the left of a right subtree must sit between two ancestors. Comparing a node only with its parent misses exactly that case.

The cost is the height h, not the size n. A balanced tree has h near log n, so a walk takes about 20 steps for a million nodes. A tree built from sorted inserts is a chain with h = n, and every walk becomes O(n). LeetCode trees are not kept balanced, so state your answers as O(h).`,

  walkthrough: {
    problemSlug: "validate-binary-search-tree",
    input: "root = [8, 4, 12, 2, 6, 10, 14, null, null, 5, 9]",
    intro: "one step per node checked, left subtree before right, each with the range its value must fall in.",
    columns: ["Node: allowed range", "What happened", "Valid so far"],
    steps: [
      { window: "8: (−∞, ∞)", action: "inside; left child gets (−∞, 8), right child gets (8, ∞)", best: "yes" },
      { window: "4: (−∞, 8)", action: "inside; its children get (−∞, 4) and (4, 8)", best: "yes" },
      { window: "2: (−∞, 4)", action: "inside; both children are null, which is valid", best: "yes" },
      { window: "6: (4, 8)", action: "inside; its children get (4, 6) and (6, 8)", best: "yes" },
      { window: "5: (4, 6)", action: "inside; no children", best: "yes" },
      { window: "9: (6, 8)", action: "9 is above its parent 6, but 9 >= 8: return false", best: "no" },
      { window: "back at 6, 4, 8", action: "each call gets false and returns false; 12 is never checked", best: "no" },
    ],
    result: "false. 9 sits in the left subtree of 8 but is larger than 8. A parent-only check would have said true.",
  },

  template: {
    code: "validate",
    note: "Carry the allowed range (lo, hi) down the tree. Going left, the node's value becomes the new hi; going right, it becomes the new lo. Use bounds wider than int (long, or infinity) so the int limits are still valid values.",
  },

  variants: [
    {
      name: "Walk one path",
      when: "You're looking for one place in the tree: a value, where to insert, or where two values split.",
      idea:
        "Compare and move left or right, never both. For the lowest common ancestor, keep going while p and q are on the same side. The first node where they split (or that is one of them) is the answer. No recursion, O(h) time and O(1) space.",
      code: "lca-bst",
      problemSlug: "lowest-common-ancestor-of-a-binary-search-tree",
    },
    {
      name: "In-order is sorted",
      when: "The question is about rank or order: the kth smallest, the next value, the smallest gap.",
      idea:
        "Walk left, node, right with an explicit stack, and count each node as it pops. The kth pop is the kth smallest, so you stop early instead of collecting all n values.",
      code: "kth-smallest",
      problemSlug: "kth-smallest-element-in-a-bst",
    },
    {
      name: "Return the new subtree root",
      when: "The tree's shape changes: insert, delete or trim.",
      idea:
        "Let each call return the root of its subtree after the change, and assign it back: root.left = delete(root.left, key). A node with two children copies up its successor (the smallest value on its right) and then deletes that value from the right subtree.",
      code: "delete-node",
      problemSlug: "delete-node-in-a-bst",
    },
  ],

  complexity: {
    time: "O(h) for one walk; O(n) to validate or to visit every node",
    space: "O(h) for the recursion or the stack",
    why: "A walk does constant work per level and moves down one level each step, so it costs the height. Validation has to look at every node once. The stack only holds one root-to-node path. For a balanced tree h is about log n; for a chain it is n.",
  },

  mistakes: [
    "Checking a node only against its parent. The rule covers whole subtrees, so pass both bounds down.",
    "Using int bounds like INT_MIN and INT_MAX. A node holding exactly that value is valid but gets rejected. Use long bounds or null for no bound.",
    "Allowing equal values. LeetCode's BSTs are strict, so a value equal to a bound is invalid unless the problem says otherwise.",
    "Recursing into both children on a search. That makes it O(n); the comparison should rule one side out.",
    "Forgetting to assign the result back after an insert or delete (root.left = ...), so the change is lost.",
    "In a delete with two children, copying the successor's value up but not deleting the successor itself, which leaves a duplicate.",
    "Saying O(log n) for an unbalanced tree. LeetCode trees can be chains, so the honest bound is O(h).",
  ],

  notThis: [
    "A plain binary tree with no ordering: the comparison tells you nothing, so visit both sides. See Tree DFS.",
    "A sorted array you only search: binary search on the array is simpler and needs no tree. See Binary Search.",
    "You need sorted order while values keep arriving and leaving in your own code: use the language's ordered set (TreeMap, std::set, or SortedList) instead of writing a BST.",
    "Only the smallest or largest is needed each time: a heap is simpler. See Heap / Top-K.",
  ],

  ladder: [
    { slug: "search-in-a-binary-search-tree", tier: "warm-up", note: "The plain walk: compare, go one way, stop at the value or null." },
    { slug: "insert-into-a-binary-search-tree", tier: "warm-up", note: "Walk to the null where the value belongs and hang a new node there." },
    { slug: "range-sum-of-bst", tier: "warm-up", note: "Skip a whole subtree when it is all below low or all above high." },
    { slug: "validate-binary-search-tree", tier: "core", note: "The template: carry (lo, hi) down so ancestors are checked too." },
    { slug: "lowest-common-ancestor-of-a-binary-search-tree", tier: "core", note: "Walk while both values are on one side; the split point is the answer." },
    { slug: "kth-smallest-element-in-a-bst", tier: "core", note: "In-order with a stack and a counter, stopping at k." },
    { slug: "convert-sorted-array-to-binary-search-tree", tier: "core", note: "Build in reverse: the middle element is the root, recurse on each half." },
    { slug: "delete-node-in-a-bst", tier: "core", note: "Return the new subtree root; two children means copy up the successor." },
    { slug: "trim-a-binary-search-tree", tier: "core", note: "A node below low means its whole left side goes too: return the trimmed right side." },
    { slug: "binary-search-tree-iterator", tier: "core", note: "The in-order stack, paused between calls: next() is one pop plus a walk left." },
    { slug: "recover-binary-search-tree", tier: "stretch", note: "In-order should be sorted; find the two places it drops and swap those values back." },
    { slug: "maximum-sum-bst-in-binary-tree", tier: "stretch", note: "Tree DFS that returns min, max, sum and is-BST for each subtree, then combines them." },
  ],
};
