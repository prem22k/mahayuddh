import java.util.*;
// ---- code ----
class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        List<List<int[]>> graph = new ArrayList<>();
        for (int i = 0; i <= n; i++) {
            graph.add(new ArrayList<>());
        }
        for (int[] t : times) {
            graph.get(t[0]).add(new int[]{t[1], t[2]});
        }
        int[] dist = new int[n + 1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[k] = 0;
        // (distance so far, node); the smallest pops first
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> a[0] != b[0]
                ? Integer.compare(a[0], b[0])
                : Integer.compare(a[1], b[1]));
        heap.offer(new int[]{0, k});
        while (!heap.isEmpty()) {
            int[] top = heap.poll();
            int d = top[0], u = top[1];
            // a stale entry: u was already reached more cheaply
            if (d > dist[u]) continue;
            // d is final for u; try every edge out of it
            for (int[] e : graph.get(u)) {
                int v = e[0], w = e[1];
                if (d + w < dist[v]) {
                    dist[v] = d + w;
                    heap.offer(new int[]{dist[v], v});
                }
            }
        }
        int best = 0;
        for (int i = 1; i <= n; i++) {
            // a node never reached: the signal can't get there
            if (dist[i] == Integer.MAX_VALUE) return -1;
            best = Math.max(best, dist[i]);
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        int[][] walk = {{1, 2, 4}, {1, 3, 1}, {3, 2, 2}, {2, 4, 1}, {3, 4, 5}};
        check(s.networkDelayTime(walk, 4, 1) == 4, "walkthrough");
        check(s.networkDelayTime(new int[][]{{2, 1, 1}, {2, 3, 1}, {3, 4, 1}}, 4, 2) == 2, "example 1");
        check(s.networkDelayTime(new int[][]{{1, 2, 1}}, 2, 1) == 1, "example 2");
        // edges are directed: 2 can't reach 1
        check(s.networkDelayTime(new int[][]{{1, 2, 1}}, 2, 2) == -1, "directed");
        check(s.networkDelayTime(new int[][]{}, 1, 1) == 0, "one node");
        // a cycle, and a direct edge that is not the shortest way
        int[][] cyc = {{1, 2, 1}, {2, 1, 1}, {2, 3, 5}, {1, 3, 10}};
        check(s.networkDelayTime(cyc, 3, 1) == 6, "cycle");
        // one node cut off among reachable ones
        check(s.networkDelayTime(new int[][]{{1, 2, 3}, {2, 3, 3}}, 4, 1) == -1, "cut off");
    }
}
