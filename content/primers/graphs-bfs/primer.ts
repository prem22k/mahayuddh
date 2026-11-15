import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "graphs-bfs",
  pattern: "Graph Theory",
  title: "Graph BFS / DFS",
  order: 16,
  prerequisites: ["tree-bfs", "tree-dfs"],
  summary:
    "For anything made of things and connections between them: cities and roads, people and friendships, or the cells of a grid and their neighbours. Visit everything you can reach once, using a visited set so cycles don't trap you. BFS gives the fewest steps; DFS is the simplest way to explore a whole region.",

  recognizeWhen: [
    "The input is a grid and the question is about connected regions (islands, rooms, areas) or moving from one cell to another.",
    "The input is n nodes plus a list of edges, or an adjacency list, and asks what is reachable or how things are grouped.",
    "The question asks for the fewest moves, steps or minutes, and every move costs the same.",
    "Something spreads from several places at once (rot, fire, water) and you want the time until it reaches everywhere.",
  ],

  coreIdea: `A graph is nodes and edges. A grid is a graph too: each cell is a node, and its edges go to the up, down, left and right cells that are inside the grid and open. You rarely build this graph; you work out the neighbours when you need them.

Unlike a tree, a graph can have cycles, so the same node can be reached twice. Keep a visited set (or a boolean grid, or overwrite the cell) and never process a node that is already in it. With that rule, every node is handled once and every edge is looked at once or twice, so the whole search is O(V + E). On a grid that is O(rows × cols).

BFS uses a queue and explores in rings: first everything 1 step away, then everything 2 steps away, and so on. So the first time BFS reaches a node, it got there by a shortest path. Process the queue one level at a time and count the levels to get the distance. Mark a node visited when you add it to the queue, not when you take it out; otherwise the same cell can be added many times by different neighbours.

DFS goes as deep as it can before backing up, using recursion or a stack. It does not find shortest paths, but it is the shortest code for "visit this whole component", which is what counting islands needs. If there are several starting points, put them all in the queue at step 0. That multi-source BFS gives each cell its distance to the nearest source in one pass.

BFS breaks when edges have different costs. Then the path with fewer edges is not always the cheapest, and you need Dijkstra.`,

  walkthrough: {
    problemSlug: "nearest-exit-from-entrance-in-maze",
    input: "maze rows = \"++++++\", \"+....+\", \"+.++..\", \"++++++\"; entrance = [1, 1]",
    intro: "one step per cell taken from the queue, with the number of moves it took to reach it. Neighbours are tried up, down, left, right.",
    columns: ["Cell taken (moves)", "What happened", "Queue after"],
    steps: [
      { window: "(1, 1) at 0", action: "the entrance, so not an exit; (2, 1) and (1, 2) are open: mark them seen and add them", best: "(2, 1), (1, 2)" },
      { window: "(2, 1) at 1", action: "not on the edge; (1, 1) is seen and the rest are walls, so nothing is added", best: "(1, 2)" },
      { window: "(1, 2) at 1", action: "not on the edge; add (1, 3)", best: "(1, 3)" },
      { window: "(1, 3) at 2", action: "not on the edge; add (1, 4)", best: "(1, 4)" },
      { window: "(1, 4) at 3", action: "not on the edge; (1, 5) is a wall, add (2, 4)", best: "(2, 4)" },
      { window: "(2, 4) at 4", action: "not on the edge; add (2, 5)", best: "(2, 5)" },
      { window: "(2, 5) at 5", action: "on the right edge and not the entrance: return 5", best: "(empty)" },
    ],
    result: "5. BFS tried the dead end at (2, 1) after one move and dropped it; no cell was added twice.",
  },

  template: {
    code: "nearest-exit",
    note: "Queue the start and mark it seen. Then, one level at a time, take each cell out, stop if it's the goal, and add every open neighbour that isn't seen yet, marking it as you add it. The level count is the number of moves.",
  },

  variants: [
    {
      name: "DFS for connected components",
      when: "You need to count or measure regions, not find distances.",
      idea:
        "Scan every cell. Each unvisited land cell starts a new island: count it, then DFS from it and mark the whole island visited. Here the grid is the visited set: a visited cell is set to \"0\".",
      code: "islands",
      problemSlug: "number-of-islands",
    },
    {
      name: "Multi-source BFS",
      when: "Something spreads from many starting cells at the same time.",
      idea:
        "Put every source in the queue before the loop, all at time 0, and count fresh cells. Each level of the BFS is one minute. If fresh cells remain when the queue is empty, some can never be reached, so return -1.",
      code: "rotting-oranges",
      problemSlug: "rotting-oranges",
    },
    {
      name: "Edge list to adjacency list",
      when: "The graph comes as n and a list of edges.",
      idea:
        "Build graph[u] as a list of u's neighbours first, adding both directions for an undirected edge. Then search with a seen array of size n. A stack gives DFS, a queue gives BFS; for \"is it reachable\" either works.",
      code: "valid-path",
      problemSlug: "find-if-path-exists-in-graph",
    },
  ],

  complexity: {
    time: "O(V + E); O(rows × cols) on a grid",
    space: "O(V) for the visited set and the queue or stack",
    why: "The visited check means each node enters the queue or the call stack at most once, and each edge is looked at once from each end. A grid cell has at most 4 edges, so the edges add only a constant factor. The queue can hold a whole level at once, and a recursive DFS can go as deep as the number of cells.",
  },

  mistakes: [
    "Marking a cell visited when it leaves the queue. Mark it when it goes in, or one cell gets queued again by each of its neighbours.",
    "Forgetting the visited set on a graph with cycles, so the search runs forever.",
    "Using DFS for fewest steps. DFS finds a path, not the shortest one; use BFS.",
    "Counting levels wrong: take exactly the cells that were in the queue when the level started (save the size first), then add one.",
    "Running a BFS from each source when many cells spread at once. Put them all in the queue at the start instead.",
    "Swapping rows and columns in the bounds check, or checking the bounds after reading grid[r][c].",
    "Recursive DFS on a large grid in Python, which passes the recursion limit. Use an explicit stack there.",
  ],

  notThis: [
    "Edges have different weights or costs: the fewest edges isn't the cheapest path. Use Dijkstra. See Shortest Path.",
    "Edges arrive one at a time and you keep asking whether two nodes are connected: use Union-Find.",
    "The graph is directed and you need an order where every node comes after its prerequisites: see Topological Sort.",
    "You need every path, not just whether one exists: that is backtracking, and the visited mark is undone on the way back. See Backtracking.",
  ],

  ladder: [
    { slug: "flood-fill", tier: "warm-up", note: "One DFS from one cell: recolour the region it belongs to." },
    { slug: "find-if-path-exists-in-graph", tier: "warm-up", note: "Build the adjacency list from edges, then search from the source." },
    { slug: "keys-and-rooms", tier: "warm-up", note: "The adjacency list is given; check that one search visits every room." },
    { slug: "number-of-islands", tier: "core", note: "Count components: every fresh DFS start is a new island." },
    { slug: "max-area-of-island", tier: "core", note: "The same DFS, returning the size of each island." },
    { slug: "nearest-exit-from-entrance-in-maze", tier: "core", note: "The template: BFS by levels for the fewest moves to any edge cell." },
    { slug: "rotting-oranges", tier: "core", note: "Multi-source BFS: every rotten orange starts at minute 0." },
    { slug: "01-matrix", tier: "core", note: "Multi-source BFS from every 0 gives each cell its distance to the nearest 0." },
    { slug: "surrounded-regions", tier: "core", note: "Flip the question: search from the border, then capture whatever wasn't reached." },
    { slug: "pacific-atlantic-water-flow", tier: "core", note: "Search uphill from each ocean's edge; the answer is the cells both searches reach." },
    { slug: "clone-graph", tier: "core", note: "The visited map stores each node's copy, so cycles reuse it." },
    { slug: "word-ladder", tier: "stretch", note: "The nodes are words and the edges are one-letter changes: BFS on a graph you never build." },
    { slug: "shortest-path-in-a-grid-with-obstacles-elimination", tier: "stretch", note: "The state is (row, col, removals left), so visited must track all three." },
  ],
};
