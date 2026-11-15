import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "topological-sort",
  pattern: "Topological Sort",
  title: "Topological Sort",
  order: 17,
  prerequisites: ["graphs-bfs"],
  summary:
    "For tasks with \"do this before that\" rules: courses and prerequisites, build steps, recipes and ingredients. Put the tasks in an order where every task comes after everything it depends on, or find out that a cycle makes this impossible.",

  recognizeWhen: [
    "The input is a list of pairs meaning \"a needs b first\": prerequisites, dependencies, ingredients.",
    "The question asks for a valid order, or whether all tasks can be finished at all.",
    "The edges are directed and a cycle would make the answer impossible.",
    "Each task takes time, things can run in parallel, and you want the earliest finish: the longest path through the dependencies.",
  ],

  coreIdea: `Draw each task as a node and each rule "b before a" as an edge b → a. A node's in-degree is the number of edges coming into it: how many tasks it is still waiting for. A task with in-degree 0 is free to do right now.

Kahn's algorithm keeps a queue of free tasks. Take one out, add it to the order, and remove its outgoing edges by lowering each neighbour's in-degree by one. Any neighbour that drops to 0 has nothing left to wait for, so it joins the queue. Repeat until the queue is empty.

The invariant is that a task joins the queue only after every task it depends on is already in the order. So the order is always valid. It is fast because each node is queued once and each edge is removed once: O(V + E).

The same loop detects cycles for free. Tasks on a cycle wait on each other, so their in-degree never reaches 0 and they never enter the queue. If the order ends with fewer than n tasks, there is a cycle and no valid order exists.

DFS can do the same job: mark each node as "on the current path" while you explore it and "done" after. Reaching a node that is still on the path means a cycle. A plain visited flag is not enough for directed graphs, because two paths that meet again (a diamond) are not a cycle.`,

  walkthrough: {
    problemSlug: "course-schedule-ii",
    input: "numCourses = 6, prerequisites = [[1,0], [2,0], [3,1], [3,2], [4,3], [4,5]]",
    intro: "one step per course taken from the queue, after counting in-degrees. [a, b] is the edge b → a.",
    columns: ["Queue", "What happened", "Order so far"],
    steps: [
      { window: "[0, 5]", action: "in-degrees are 0:0, 1:1, 2:1, 3:2, 4:2, 5:0; queue the two courses that need nothing", best: "[]" },
      { window: "[5, 1, 2]", action: "take 0; 1 and 2 drop to 0, so both join the queue", best: "[0]" },
      { window: "[1, 2]", action: "take 5; 4 drops from 2 to 1 and keeps waiting", best: "[0, 5]" },
      { window: "[2]", action: "take 1; 3 drops from 2 to 1", best: "[0, 5, 1]" },
      { window: "[3]", action: "take 2; 3 drops to 0 and joins", best: "[0, 5, 1, 2]" },
      { window: "[4]", action: "take 3; 4 drops to 0 and joins", best: "[0, 5, 1, 2, 3]" },
      { window: "[]", action: "take 4; queue empty, 6 of 6 courses placed, so there is no cycle", best: "[0, 5, 1, 2, 3, 4]" },
    ],
    result: "[0, 5, 1, 2, 3, 4]. Course 3 waited until both 1 and 2 were done; other valid orders exist and are also accepted.",
  },

  template: {
    code: "kahn",
    note: "Build the edges and in-degrees, queue every in-degree 0 node, then take, append and lower the neighbours' counts, queueing any that reach 0. If the order is shorter than n, there was a cycle.",
  },

  variants: [
    {
      name: "Kahn's on the reversed graph",
      when: "A node is good only if everything it points to is good, starting from nodes with no way out.",
      idea:
        "Flip every edge and use out-degree in place of in-degree. Terminal nodes start in the queue. When a node's last outgoing edge leads to a safe node, its count hits 0 and it is safe too. Nodes on or leading into a cycle never get there.",
      code: "safe-states",
      problemSlug: "find-eventual-safe-states",
    },
    {
      name: "DFS with three states",
      when: "You only need to know whether a cycle exists, and DFS feels more natural.",
      idea:
        "Give each node a state: 0 not visited, 1 on the current path, 2 done. Meeting a 1 means you came back around: a cycle. Meeting a 2 is safe; that node was fully checked. Set 1 on entry and 2 on exit.",
      code: "dfs-cycle",
      problemSlug: "course-schedule",
    },
    {
      name: "Longest path in the order",
      when: "Tasks take time, run in parallel, and each must wait for all its prerequisites.",
      idea:
        "Run Kahn's and carry start[v], the earliest time v can begin. When u finishes at start[u] + time[u], push that into each neighbour: start[v] = max(start[v], finish). The answer is the largest finish time.",
      code: "longest-path",
      problemSlug: "parallel-courses-iii",
    },
  ],

  complexity: {
    time: "O(V + E)",
    space: "O(V + E) for the adjacency list, plus O(V) for counts and the queue",
    why: "Building the graph reads every edge once. In the loop, each node enters the queue at most once, and each edge lowers one in-degree exactly once when its source is taken out. DFS with three states also visits each node and edge once.",
  },

  mistakes: [
    "Getting the edge direction backwards. For [a, b] meaning b before a, the edge is b → a and a's in-degree goes up.",
    "Forgetting the cycle check: return the order only if it holds all n nodes.",
    "Starting from one node only. Every node with in-degree 0 goes in the queue at the start, including ones with no edges at all.",
    "Using a single visited flag for DFS cycle detection on a directed graph, which calls a diamond a cycle. Use three states.",
    "Lowering in-degrees but queueing a node before it reaches exactly 0.",
    "Missing self-loops like [0, 0]. They count as a cycle, and Kahn's handles them only if the edge is added like any other.",
  ],

  notThis: [
    "The edges are undirected: there is no \"before\". To find groups use Graph BFS / DFS or Union-Find.",
    "You need the shortest path in a weighted graph with cycles: use Dijkstra. See Shortest Path.",
    "The question is only whether two items end up connected, not in what order: use Union-Find.",
  ],

  ladder: [
    { slug: "find-the-town-judge", tier: "warm-up", note: "Count in-degree and out-degree: the judge has n − 1 in and 0 out." },
    { slug: "course-schedule", tier: "warm-up", note: "Kahn's as a yes/no: did all n courses get taken?" },
    { slug: "course-schedule-ii", tier: "core", note: "The template: return the order itself, or [] for a cycle." },
    { slug: "find-eventual-safe-states", tier: "core", note: "Reverse the edges and peel back from the terminal nodes." },
    { slug: "find-all-possible-recipes-from-given-supplies", tier: "core", note: "Nodes are strings: supplies start in the queue, recipes wait on their ingredients." },
    { slug: "course-schedule-iv", tier: "core", note: "Pass each node's set of prerequisites forward in topological order, then answer queries." },
    { slug: "minimum-height-trees", tier: "core", note: "Kahn's on an undirected tree: trim leaves layer by layer until one or two nodes remain." },
    { slug: "parallel-courses-iii", tier: "stretch", note: "Carry the earliest start time through the order: the longest path in a DAG." },
    { slug: "largest-color-value-in-a-directed-graph", tier: "stretch", note: "A DP table of 26 counts per node, pushed along the order, plus the cycle check." },
    { slug: "sort-items-by-groups-respecting-dependencies", tier: "stretch", note: "Two levels of topological sort: groups first, then items inside each group." },
  ],
};
