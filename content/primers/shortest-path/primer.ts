import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "shortest-path",
  pattern: "Shortest Path",
  title: "Shortest Path",
  order: 19,
  prerequisites: ["graphs-bfs", "heap-top-k"],
  summary:
    "For the cheapest route through a graph whose edges have different costs. Dijkstra settles nodes in order of distance with a min-heap; 0-1 BFS and Bellman-Ford cover the cases it can't.",

  recognizeWhen: [
    "The question asks for the minimum total cost, time or distance from one place to another, and edges cost different amounts.",
    "Plain BFS would work if every edge cost the same, but here they don't.",
    "A grid where each move has a price: a height difference, an obstacle to remove, a wait.",
    "The cost of a path isn't a sum but still only gets worse as the path grows: the largest step, or a product of probabilities.",
    "There is an extra limit on the path, such as at most k stops, which turns into rounds of relaxation.",
  ],

  coreIdea: `Keep dist[v], the cheapest cost found so far to reach v, with dist[source] = 0 and everything else infinite. Put (0, source) in a min-heap. Pop the smallest entry (d, u). Then relax every edge u → v with weight w: if d + w beats dist[v], lower dist[v] and push (dist[v], v).

The invariant: when a node is popped for the first time, its distance is final. Every entry still in the heap is at least d, and edges never cost less than 0, so no path through another node can come back cheaper. That's why Dijkstra needs non-negative weights.

A node can sit in the heap several times, once for each time its distance dropped. When an old entry pops with d > dist[u], skip it. Without that check, nodes get processed again and the time blows up. With it, each edge is relaxed once from its final distance, and there are at most E pushes. That gives O((V + E) log V) time.

When weights are only 0 or 1, use a deque instead of a heap: push the 0-edge neighbour to the front and the 1-edge neighbour to the back. The deque stays sorted by distance, so it's Dijkstra in O(V + E). This is 0-1 BFS.

Dijkstra breaks on negative edges. A node can be popped and finished, and then a negative edge makes it cheaper later. Then use Bellman-Ford: relax every edge V − 1 times, in O(V · E). It also helps when the path may use at most k edges, since each round adds one more edge. A further round that still improves something means there's a negative cycle.`,

  walkthrough: {
    problemSlug: "network-delay-time",
    input: "times = [[1,2,4],[1,3,1],[3,2,2],[2,4,1],[3,4,5]], n = 4, k = 1",
    intro: "one step per pop from the heap, which starts as {(0, 1)}.",
    columns: ["Heap after the step", "What happened", "dist for nodes 1, 2, 3, 4"],
    steps: [
      { window: "{(1,3), (4,2)}", action: "pop (0,1): node 1 is final. Relax: 2 gets 0+4 = 4, 3 gets 0+1 = 1", best: "0, 4, 1, ∞" },
      { window: "{(3,2), (4,2), (6,4)}", action: "pop (1,3): node 3 is final. 2 drops to 1+2 = 3; 4 gets 1+5 = 6", best: "0, 3, 1, 6" },
      { window: "{(4,2), (4,4), (6,4)}", action: "pop (3,2): node 2 is final. 4 drops to 3+1 = 4", best: "0, 3, 1, 4" },
      { window: "{(4,4), (6,4)}", action: "pop (4,2): stale, because dist[2] is already 3. Skip", best: "0, 3, 1, 4" },
      { window: "{(6,4)}", action: "pop (4,4): node 4 is final. It has no edges out", best: "0, 3, 1, 4" },
      { window: "{}", action: "pop (6,4): stale, because dist[4] is already 4. Skip", best: "0, 3, 1, 4" },
    ],
    result: "4, the largest final distance. The direct edge 1 → 2 costs 4, but the path 1 → 3 → 2 costs 3, and Dijkstra found it because node 3 popped first.",
  },

  template: {
    code: "dijkstra",
    note: "Pop the smallest, skip it if stale, relax its edges, push what improved. Change what a path costs (a sum, a max, a product) and how you store the graph, and the loop stays the same.",
  },

  variants: [
    {
      name: "0-1 BFS",
      when: "Every move costs 0 or 1: remove an obstacle or not, follow a sign or change it.",
      idea:
        "Swap the heap for a deque. A 0-cost neighbour goes to the front and a 1-cost neighbour to the back, so the front always holds the smallest distance. Same relax rule, O(V + E).",
      code: "zero-one-bfs",
      problemSlug: "minimum-obstacle-removal-to-reach-corner",
    },
    {
      name: "Minimax path",
      when: "A path is as bad as its worst step: the biggest height jump, the highest water level.",
      idea:
        "Use max(d, step) instead of d + step. It still never gets smaller as the path grows, so the first pop of the target is final and you can return there.",
      code: "min-effort",
      problemSlug: "path-with-minimum-effort",
    },
    {
      name: "At most k edges: Bellman-Ford rounds",
      when: "The path may use at most k + 1 edges, or weights can be negative.",
      idea:
        "Run k + 1 rounds. In each round, copy last round's costs and relax every edge from the copy. After r rounds, cost[v] is the cheapest path with at most r edges. Without the copy, one round can chain several edges.",
      code: "bellman-ford-k",
      problemSlug: "cheapest-flights-within-k-stops",
    },
  ],

  complexity: {
    time: "O((V + E) log V) for Dijkstra; O(V + E) for 0-1 BFS; O(k · E) for k rounds of Bellman-Ford",
    space: "O(V + E)",
    why: "Each successful relax pushes one entry, so the heap gets at most E pushes and each costs O(log E) = O(log V). Stale entries are popped once and skipped. 0-1 BFS does O(1) work per deque operation. Bellman-Ford looks at every edge once per round. All three store the adjacency list and one distance per node.",
  },

  mistakes: [
    "Using Dijkstra with negative edge weights. A node popped as final can get cheaper later; use Bellman-Ford.",
    "Leaving out the stale check (d > dist[u]). Answers stay correct, but old entries make you relax the same edges again and again.",
    "Marking a node visited when you push it instead of when you pop it. A cheaper path found later is then ignored.",
    "Starting with an infinity that overflows: INT_MAX + w wraps negative. Guard it, or use a large value that leaves room.",
    "Forgetting the copy in k-limited Bellman-Ford. Reading this round's updates lets one round use several edges.",
    "Treating a directed graph as undirected, or the reverse. Read whether u → v also means v → u.",
    "Returning dist[target] without checking it was ever reached. Unreached nodes keep infinity; the problem usually wants −1.",
  ],

  notThis: [
    "Every edge costs the same: plain BFS gives shortest steps in O(V + E). See Graph BFS / DFS.",
    "You need distances between every pair of nodes and V is small (a few hundred): Floyd-Warshall, three nested loops in O(V³).",
    "The graph is a DAG: relax edges in topological order in O(V + E), even with negative weights. See Topological Sort.",
    "You only need to know whether two nodes connect, not the cost: Union-Find or a single BFS.",
  ],

  ladder: [
    { slug: "shortest-path-in-binary-matrix", tier: "warm-up", note: "All moves cost 1, so BFS is already a shortest path. The baseline Dijkstra generalises." },
    { slug: "network-delay-time", tier: "warm-up", note: "The template: Dijkstra from one source, then the largest distance." },
    { slug: "path-with-maximum-probability", tier: "core", note: "Maximise a product of values in [0, 1]: a max-heap, and the path only gets worse as it grows." },
    { slug: "path-with-minimum-effort", tier: "core", note: "Dijkstra on a grid where a path costs its worst step." },
    { slug: "cheapest-flights-within-k-stops", tier: "core", note: "A limit on edges: k + 1 rounds of Bellman-Ford, reading from a copy." },
    { slug: "find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance", tier: "core", note: "All pairs on a small graph: Dijkstra from every node, or Floyd-Warshall." },
    { slug: "number-of-ways-to-arrive-at-destination", tier: "core", note: "Count shortest paths: add ways on a tie, reset them on an improvement." },
    { slug: "minimum-obstacle-removal-to-reach-corner", tier: "core", note: "Weights of 0 and 1: 0-1 BFS with a deque." },
    { slug: "swim-in-rising-water", tier: "stretch", note: "Minimax again: the time is the highest cell on the path." },
    { slug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid", tier: "stretch", note: "Following the arrow costs 0 and changing it costs 1: 0-1 BFS with the costs to work out yourself." },
    { slug: "minimum-time-to-visit-a-cell-in-a-grid", tier: "stretch", note: "Waiting is allowed, so the arrival time at a cell depends on parity. Dijkstra with a smarter relax." },
  ],
};
