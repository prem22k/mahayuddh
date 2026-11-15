import java.util.*;
// ---- code ----
class Solution {
    public int findCheapestPrice(int n, int[][] flights,
                                 int src, int dst, int k) {
        int[] cost = new int[n];
        Arrays.fill(cost, Integer.MAX_VALUE);
        cost[src] = 0;
        // after r rounds: the cheapest using at most r flights
        for (int round = 0; round <= k; round++) {
            // copy first, so a round adds at most one flight
            int[] prev = cost.clone();
            for (int[] f : flights) {
                int u = f[0], v = f[1], w = f[2];
                if (prev[u] != Integer.MAX_VALUE
                        && prev[u] + w < cost[v]) {
                    cost[v] = prev[u] + w;
                }
            }
        }
        return cost[dst] == Integer.MAX_VALUE ? -1 : cost[dst];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        int[][] f1 = {{0, 1, 100}, {1, 2, 100}, {2, 0, 100}, {1, 3, 600}, {2, 3, 200}};
        check(s.findCheapestPrice(4, f1, 0, 3, 1) == 700, "example 1");
        int[][] f2 = {{0, 1, 100}, {1, 2, 100}, {0, 2, 500}};
        check(s.findCheapestPrice(3, f2, 0, 2, 1) == 200, "example 2");
        check(s.findCheapestPrice(3, f2, 0, 2, 0) == 500, "example 3");
        check(s.findCheapestPrice(3, new int[][]{{0, 1, 5}}, 0, 2, 2) == -1, "unreachable");
        // without the copy, 0 -> 1 -> 2 sneaks in with k = 0
        int[][] f3 = {{0, 1, 1}, {1, 2, 1}, {0, 2, 5}};
        check(s.findCheapestPrice(3, f3, 0, 2, 0) == 5, "copy matters");
        check(s.findCheapestPrice(3, f3, 0, 2, 1) == 2, "one stop");
        // more stops allowed than needed is fine
        check(s.findCheapestPrice(3, f3, 0, 2, 5) == 2, "spare stops");
    }
}
