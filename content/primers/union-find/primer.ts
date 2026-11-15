import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "union-find",
  pattern: "Union-Find",
  title: "Union-Find",
  order: 18,
  prerequisites: ["graphs-bfs"],
  summary:
    "Keeps items in groups and answers two questions fast: which group is x in, and merge the groups of a and b. Use it when connections arrive one at a time and you keep asking whether two things are already connected.",

  recognizeWhen: [
    "Edges or \"a is linked to b\" facts come one by one, and you need to know if two items are already connected.",
    "You want the number of connected groups, or the size of each, without running a full search.",
    "Adding an edge between two already-connected nodes is the event that matters: it closes a cycle.",
    "Equal-to facts first, then not-equal checks: a == b means same group.",
    "Kruskal's minimum spanning tree: take the cheapest edges that join two different groups.",
  ],

  coreIdea: `Store the groups as a forest. parent[x] points to another member of x's group, and the root, the one node whose parent is itself, names the group. find(x) follows parent pointers up to the root. Two items are in the same group exactly when they have the same root. To merge two groups, find both roots and make one root point at the other.

Done naively, the trees can become long chains and find costs O(n). Two small rules fix this. Union by size hangs the smaller tree under the root of the bigger one, so a node only gets deeper when its group at least doubles, and no tree is taller than log n. Path compression goes further: while find walks up to the root, it points every node it passes straight at the root, so the next find from any of them takes one step.

With both rules, a sequence of m operations costs O(m α(n)). α is the inverse Ackermann function, which is at most 4 for any input that fits in a computer, so treat each operation as constant time.

Have unite return whether it actually merged anything. False means the two items were already connected, which is how you spot a redundant edge, and counting the true results tells you how many groups remain.

Union-Find only merges. It can't split a group or remove an edge, and it doesn't give you a path between two nodes. For those, search the graph instead.`,

  walkthrough: {
    problemSlug: "redundant-connection",
    input: "edges = [[1,2], [3,4], [2,4], [5,6], [4,6], [1,5]]",
    intro: "one step per edge. Each group is written with its root first.",
    columns: ["Groups", "What happened", "Answer"],
    steps: [
      { window: "{1,2} {3} {4} {5} {6}", action: "[1,2]: roots 1 and 2, both size 1; 2 goes under 1", best: "none yet" },
      { window: "{1,2} {3,4} {5} {6}", action: "[3,4]: different roots; 4 goes under 3", best: "none yet" },
      { window: "{1,2,3,4} {5} {6}", action: "[2,4]: roots 1 and 3, both size 2; root 3 goes under 1", best: "none yet" },
      { window: "{1,2,3,4} {5,6}", action: "[5,6]: different roots; 6 goes under 5", best: "none yet" },
      { window: "{1,2,3,4,5,6}", action: "[4,6]: find(4) walks 4 → 3 → 1 and repoints 4 straight at 1; root 5 (size 2) goes under 1 (size 4)", best: "none yet" },
      { window: "{1,2,3,4,5,6}", action: "[1,5]: find(1) = 1 and find(5) = 1, the same root; unite returns false", best: "[1,5]" },
    ],
    result: "[1,5]. Nodes 1 and 5 were already joined through 2, 4 and 6, so this edge closes the cycle 1 → 2 → 4 → 6 → 5 → 1.",
  },

  template: {
    code: "redundant",
    note: "find with path compression, unite with union by size that returns false when the roots already match. Most Union-Find problems are this class plus a short loop that calls unite and reacts to its answer.",
  },

  variants: [
    {
      name: "Count the groups",
      when: "The answer depends on how many separate groups there are.",
      idea:
        "Start with n groups and subtract one each time unite returns true. Joining k groups takes k − 1 edges. Check the cheap impossible case first: fewer than n − 1 edges can never connect n nodes.",
      code: "network",
      problemSlug: "number-of-operations-to-make-network-connected",
    },
    {
      name: "Union first, then check",
      when: "Some facts join items and others must keep them apart.",
      idea:
        "Make two passes. First unite every \"==\" pair, so the groups are final. Then check each \"!=\" pair and fail if both sides have the same root. Checking during the first pass misses an equality that arrives later.",
      code: "equations",
      problemSlug: "satisfiability-of-equality-equations",
    },
    {
      name: "Sort the edges, then unite (Kruskal)",
      when: "Connect everything at the lowest total cost.",
      idea:
        "List every edge with its cost and sort from cheapest. Take an edge only if unite returns true, because an edge inside one group would form a cycle. Stop after n − 1 edges.",
      code: "kruskal",
      problemSlug: "min-cost-to-connect-all-points",
    },
  ],

  complexity: {
    time: "O(α(n)) per find or unite, amortized: effectively constant",
    space: "O(n) for parent and size",
    why: "Union by size keeps every tree at most log n tall, and path compression flattens each path it walks, so later finds are short. Together the cost per operation is the inverse Ackermann function, which never goes above 4 in practice. Kruskal adds O(E log E) for the sort.",
  },

  mistakes: [
    "Comparing parent[a] == parent[b] instead of find(a) == find(b). Two nodes can share a root without sharing a parent.",
    "In unite, setting parent[a] = b instead of parent[root of a] = root of b. That moves one node and leaves the rest of its group behind.",
    "Skipping both union by size and path compression. Then a chain forms and every find is O(n).",
    "Making the parent array size n when the nodes are numbered 1..n. Allocate n + 1.",
    "Counting groups by counting distinct parent values. Count the roots (parent[x] == x), or keep a counter that unite decreases.",
    "Checking \"!=\" facts before all the \"==\" facts have been united.",
    "Reaching for Union-Find when the question needs the path itself or the distance. It only knows the groups.",
  ],

  notThis: [
    "You need the shortest number of steps between two nodes: use BFS. See Graph BFS / DFS.",
    "The graph is fixed and you only count components once: one DFS or BFS pass is just as fast and shorter to write. See Graph BFS / DFS.",
    "Edges are directed and you need an order or a cycle check on them: Union-Find ignores direction. See Topological Sort.",
    "Edges get removed over time: Union-Find can't split groups. Process the removals backwards as additions, or search again.",
  ],

  ladder: [
    { slug: "number-of-provinces", tier: "warm-up", note: "Unite every connected pair and count what's left." },
    { slug: "redundant-connection", tier: "warm-up", note: "The template: the first edge whose unite returns false." },
    { slug: "number-of-operations-to-make-network-connected", tier: "core", note: "Count groups; k groups need k − 1 moved cables." },
    { slug: "satisfiability-of-equality-equations", tier: "core", note: "Unite all \"==\" first, then check every \"!=\"." },
    { slug: "accounts-merge", tier: "core", note: "Map each email to an id, unite emails in the same account, then collect each root's emails." },
    { slug: "most-stones-removed-with-same-row-or-column", tier: "core", note: "Unite stones that share a row or column; the answer is stones minus groups." },
    { slug: "smallest-string-with-swaps", tier: "core", note: "Swappable positions form groups; sort the letters inside each group." },
    { slug: "min-cost-to-connect-all-points", tier: "core", note: "Kruskal: sort the edges, keep each one that joins two groups." },
    { slug: "swim-in-rising-water", tier: "stretch", note: "Open cells in order of height and stop when the corners share a root." },
    { slug: "remove-max-number-of-edges-to-keep-graph-fully-traversable", tier: "stretch", note: "Two DSUs, one per person; shared edges go into both first." },
    { slug: "checking-existence-of-edge-length-limited-paths", tier: "stretch", note: "Sort queries and edges by limit and add edges as the limit grows." },
  ],
};
