import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "tree-bfs",
  pattern: "Breadth-First Search",
  title: "Tree BFS",
  order: 13,
  prerequisites: ["tree-dfs"],
  summary:
    "For binary tree questions about levels: the values at each depth, the first or last node of every level, the shallowest leaf. A queue visits the tree one level at a time, closest to the root first.",

  recognizeWhen: [
    "The answer is grouped by depth: a list per level, an average or max per level, the rightmost node of each level.",
    "You want the nearest of something: the minimum depth, the first leaf, the closest node with a property.",
    "The output order is top to bottom, left to right, or alternates direction per level.",
    "Nodes on the same level have to be compared with each other (cousins, width, even-odd rules).",
  ],

  coreIdea: `Put the root in a queue. Repeatedly take a node from the front and add its children to the back. Because children always join behind everything already waiting, the tree comes out one level at a time: all of depth 0, then all of depth 1, and so on.

To know where one level ends, read the queue's length before you start popping. At that moment the queue holds exactly one full level and nothing else. Pop that many nodes; their children, added during the loop, form the next level. This size snapshot is the whole trick, and nearly every level problem is this loop with something different done to each level.

It's correct because a node at depth d is added while its parent at depth d − 1 is being processed, so every depth d − 1 node leaves the queue before any depth d node does. That ordering is also why BFS finds the shallowest leaf first and can stop right there, while DFS might explore a deep branch before it finds a shallow one.

Each node is added once and removed once, so the time is O(n). The queue holds at most one level plus part of the next, so the memory is O(w), where w is the widest level. That can be about n/2 for a full tree, which is more than DFS's O(h) on a balanced tree. When levels don't matter and you just need to visit every node, DFS is simpler.`,

  walkthrough: {
    problemSlug: "binary-tree-level-order-traversal",
    input: "root = [3,9,20,null,null,15,7]",
    intro: "one step per node popped.",
    columns: ["Queue after", "What happened", "Levels so far"],
    steps: [
      { window: "9, 20", action: "level of 1: pop 3, push 9 and 20; level done", best: "[[3]]" },
      { window: "20", action: "level of 2: pop 9, no children", best: "[[3]], building [9]" },
      { window: "15, 7", action: "pop 20, push 15 and 7; level done", best: "[[3], [9, 20]]" },
      { window: "7", action: "level of 2: pop 15, no children", best: "[[3], [9, 20]], building [15]" },
      { window: "(empty)", action: "pop 7; level done; queue empty, stop", best: "[[3], [9, 20], [15, 7]]" },
    ],
    result: "[[3],[9,20],[15,7]]",
  },

  template: {
    code: "level-order",
    note: "Snapshot the queue's size, pop exactly that many, push their children. The size snapshot is what separates the levels; most level problems only change what you do with each popped node.",
  },

  variants: [
    {
      name: "One node per level",
      when: "You need the first or last node of each level, like the view from the right side.",
      idea:
        "Keep the template's loop and its index i. The last node popped in a level (i == size − 1) is the rightmost one; i == 0 gives the leftmost.",
      code: "right-side-view",
      problemSlug: "binary-tree-right-side-view",
    },
    {
      name: "Alternate the direction",
      when: "Odd levels read right to left, even levels left to right.",
      idea:
        "Don't change the order you push children: that would break the next level. Build each level normally and reverse it before saving when the flag says so, then flip the flag.",
      code: "zigzag",
      problemSlug: "binary-tree-zigzag-level-order-traversal",
    },
    {
      name: "Stop at the first hit",
      when: "You want the shallowest node with some property, like the nearest leaf.",
      idea:
        "Levels come out in order of depth, so the first leaf you pop is a shallowest one. Return the depth right there instead of finishing the tree.",
      code: "min-depth",
      problemSlug: "minimum-depth-of-binary-tree",
    },
  ],

  complexity: {
    time: "O(n)",
    space: "O(w), where w is the widest level (up to about n/2)",
    why: "Every node is pushed once and popped once, and the work per node is constant. The queue holds at most one full level plus the children added so far, so its size is bounded by the widest part of the tree. The output list itself takes O(n).",
  },

  mistakes: [
    "Re-reading the queue's size while the loop pushes children, as in for (i = 0; i < q.size(); i++). Save the size first. (Python's range(len(queue)) is fine: it's read once.)",
    "Pushing null children and then reading .val from them. Check before you push.",
    "Using a Python list with pop(0) as the queue. Each pop is O(n); use collections.deque.",
    "For zigzag, reversing the order children are pushed. That scrambles the next level; reverse the finished level instead.",
    "Treating a node with one child as a leaf in minimum depth. Only a node with no children ends a path.",
    "Forgetting the empty tree. Return early when root is null.",
  ],

  notThis: [
    "The answer combines whole subtrees (height, diameter, balanced, path sums): recursion is shorter. See Tree DFS.",
    "Levels don't matter and you only need to visit every node once: DFS uses O(h) memory instead of O(w).",
    "Shortest path in a graph, not a tree: the same queue, plus a visited set because nodes can be reached twice. See Graph BFS / DFS.",
  ],

  ladder: [
    { slug: "average-of-levels-in-binary-tree", tier: "warm-up", note: "The template with a running sum per level instead of a list." },
    { slug: "minimum-depth-of-binary-tree", tier: "warm-up", note: "Stop at the first leaf: a case where BFS beats DFS." },
    { slug: "cousins-in-binary-tree", tier: "warm-up", note: "Same level, different parents: note each node's parent while you scan a level." },
    { slug: "binary-tree-level-order-traversal", tier: "core", note: "The template: snapshot the size, pop that many." },
    { slug: "binary-tree-right-side-view", tier: "core", note: "Keep only the last node of each level." },
    { slug: "binary-tree-zigzag-level-order-traversal", tier: "core", note: "Reverse every other finished level." },
    { slug: "find-largest-value-in-each-tree-row", tier: "core", note: "One number per level: its max." },
    { slug: "maximum-level-sum-of-a-binary-tree", tier: "core", note: "Compare whole levels and keep the first best one." },
    { slug: "even-odd-tree", tier: "core", note: "Check a rule between neighbours inside a level." },
    { slug: "maximum-width-of-binary-tree", tier: "core", note: "Carry a position index with each node; width is last minus first plus one." },
    { slug: "all-nodes-distance-k-in-binary-tree", tier: "core", note: "Add parent links, then BFS outward k steps from the target, like a graph." },
    { slug: "amount-of-time-for-binary-tree-to-be-infected", tier: "stretch", note: "The same spread from a start node, run until every node is reached." },
    { slug: "vertical-order-traversal-of-a-binary-tree", tier: "stretch", note: "Carry (row, column) with each node, then sort the ties." },
    { slug: "serialize-and-deserialize-binary-tree", tier: "stretch", note: "Write the tree out level by level with null markers, then rebuild it with the same queue." },
  ],
};
