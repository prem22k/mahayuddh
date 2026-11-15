import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "tree-dfs",
  pattern: "Depth-First Search",
  title: "Tree DFS",
  order: 12,
  prerequisites: ["linked-list"],
  summary:
    "For binary tree questions where each node's answer depends on its subtrees (heights, sums, paths) or on the path from the root. A recursive function returns what the parent needs, and every node is visited once.",

  recognizeWhen: [
    "The input is a TreeNode root and the answer is a number or a yes/no about the whole tree: depth, diameter, balanced, same tree.",
    "A node's answer can be built from its left and right children's answers.",
    "The question is about root-to-leaf paths, or about what lies above a node (the largest value so far, the sum so far).",
    "You need to find a node or a meeting point of two nodes (lowest common ancestor).",
  ],

  coreIdea: `Treat every node as the root of its own small tree. Write a function that solves the problem for one subtree, assuming the calls on its left and right children already return the right answers. Then add the base case: an empty subtree (null) returns something neutral, like 0 for a height or true for "is balanced".

Information moves in two directions. Bottom-up, a node gets results from its children and returns one result to its parent, like a height. Top-down, a node passes something into its children's calls, like the largest value seen on the path so far. Many problems need one of each.

Often the parent needs one thing and the question asks for another. In the diameter problem the parent needs the height of a subtree, but the answer is the longest path, and that path can bend at any node. So the function returns the height and, at each node, updates a separate best value with left height + right height. Mixing the two in one return value is the classic bug.

It's correct by induction: if the children's calls are right, the node's combination is right, and null is right by definition. It's fast because each node is entered once and does constant work beyond its two calls, so O(n) time. The recursion stack holds one frame per level, O(h) space, which is O(log n) for a balanced tree and O(n) for a tree shaped like a line. Very deep trees can overflow the stack; then use an explicit stack.`,

  walkthrough: {
    problemSlug: "diameter-of-binary-tree",
    input: "root = [1,2,3,4,5]",
    intro: "one step per node, in the order the calls return (children before parent).",
    columns: ["Node", "What happened", "Best path (edges)"],
    steps: [
      { window: "4 (leaf)", action: "left 0, right 0: path 0; return height 1", best: "0" },
      { window: "5 (leaf)", action: "left 0, right 0: path 0; return height 1", best: "0" },
      { window: "2", action: "left 1, right 1: path 1 + 1 = 2; return height 2", best: "2" },
      { window: "3 (leaf)", action: "left 0, right 0: path 0; return height 1", best: "2" },
      { window: "1 (root)", action: "left 2, right 1: path 2 + 1 = 3; return height 3", best: "3" },
    ],
    result: "3, the path 4 → 2 → 1 → 3 (or 5 → 2 → 1 → 3)",
  },

  template: {
    code: "diameter",
    note: "Return what the parent needs (the height); record what the question asks (the best path) on the side. Base case first, then the two calls, then combine.",
  },

  variants: [
    {
      name: "Top-down: pass state into the children",
      when: "Whether a node counts depends on the path above it: the max so far, the sum so far, the depth.",
      idea:
        "Add a parameter that carries the path's state. Update it at the node, then hand the new value to both children. Each child gets its own copy, so nothing leaks from the left branch into the right.",
      code: "good-nodes",
      problemSlug: "count-good-nodes-in-binary-tree",
    },
    {
      name: "Return what you found",
      when: "You're searching for nodes and need where their paths meet.",
      idea:
        "Return the target if this node is one, else whatever the children found. If both sides return something, this node is the lowest common ancestor. If one side does, pass it up.",
      code: "lca",
      problemSlug: "lowest-common-ancestor-of-a-binary-tree",
    },
    {
      name: "Carry a path, undo on the way up",
      when: "The answer lists whole root-to-leaf paths, not just a count.",
      idea:
        "Keep one shared list. Append the node before recursing and remove it after both children return, so the list always holds exactly the current path. Copy it when you record an answer. This is backtracking on a tree.",
      code: "path-sum-ii",
      problemSlug: "path-sum-ii",
    },
  ],

  complexity: {
    time: "O(n)",
    space: "O(h) for the recursion, where h is the height",
    why: "Each node is entered once and does constant work besides its two recursive calls. The call stack only holds the nodes on the current root-to-node path, so its depth is the tree's height: about log n when balanced, up to n for a chain. Path Sum II also pays to copy each answer path.",
  },

  mistakes: [
    "Returning the answer when the parent needs something else, like returning the diameter instead of the height. Keep a separate best value.",
    "Forgetting the null base case, or putting it after code that reads node.val.",
    "Counting nodes when the question counts edges (or the reverse). Diameter is in edges; a height of 1 means one node.",
    "Treating a node with one child as a leaf. A leaf has no children at all.",
    "Sharing a path list without removing the node on the way back up, or saving the list itself instead of a copy.",
    "Using a global that isn't reset between test cases. In Java or C++, reset it at the start of the public method.",
    "Calling a height function inside another recursive function at every node, which turns O(n) into O(n²). Compute both in one pass.",
  ],

  notThis: [
    "The question is about levels: the values at each depth, the rightmost node per level, the shallowest leaf. Use BFS. See Tree BFS.",
    "The tree is a binary search tree and the question uses its order (find, insert, kth smallest): go left or right by comparing values. See Binary Search Tree.",
    "A general graph with cycles: DFS still works, but you need a visited set. See Graph BFS / DFS.",
  ],

  ladder: [
    { slug: "maximum-depth-of-binary-tree", tier: "warm-up", note: "The smallest bottom-up recursion: 1 + the taller child." },
    { slug: "invert-binary-tree", tier: "warm-up", note: "Do the same thing at every node; swap the children." },
    { slug: "same-tree", tier: "warm-up", note: "Recurse on two trees at once." },
    { slug: "path-sum", tier: "warm-up", note: "Pass the remaining sum down and check it at the leaves." },
    { slug: "diameter-of-binary-tree", tier: "core", note: "The template: return the height, record the best path on the side." },
    { slug: "balanced-binary-tree", tier: "core", note: "The same height function, with −1 meaning already unbalanced so it stops early." },
    { slug: "subtree-of-another-tree", tier: "core", note: "Run same-tree from every node: recursion inside recursion." },
    { slug: "count-good-nodes-in-binary-tree", tier: "core", note: "Top-down: carry the path maximum into each call." },
    { slug: "path-sum-ii", tier: "core", note: "Carry the whole path: add on the way down, remove on the way up." },
    { slug: "lowest-common-ancestor-of-a-binary-tree", tier: "core", note: "Return what you found and let the parent decide." },
    { slug: "construct-binary-tree-from-preorder-and-inorder-traversal", tier: "core", note: "Build the tree from index ranges, with a hash map for the root's position." },
    { slug: "house-robber-iii", tier: "core", note: "Return two values per node: the best with it and the best without it." },
    { slug: "binary-tree-maximum-path-sum", tier: "stretch", note: "Diameter with values: a negative branch counts as 0." },
    { slug: "binary-tree-cameras", tier: "stretch", note: "Return a state per node (covered, has a camera, needs one) and decide from the leaves up." },
  ],
};
