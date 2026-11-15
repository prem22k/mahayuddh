import java.util.*;

class DSU {
    int[] parent, size;

    DSU(int n) {
        parent = new int[n];
        size = new int[n];
        // each node starts as the root of its own group
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }
    }

    int find(int x) {
        // path compression: point x straight at its root
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    // false if a and b were already in one group
    boolean unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        // union by size: the smaller group goes under
        if (size[ra] < size[rb]) {
            int t = ra;
            ra = rb;
            rb = t;
        }
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
}
// ---- code ----
class Solution {
    public int minCostConnectPoints(int[][] points) {
        int n = points.length;
        List<int[]> edges = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int d = Math.abs(points[i][0] - points[j][0])
                      + Math.abs(points[i][1] - points[j][1]);
                edges.add(new int[] {d, i, j});
            }
        }
        // cheapest edges first
        edges.sort((a, b) -> Integer.compare(a[0], b[0]));
        DSU dsu = new DSU(n);
        int total = 0, used = 0;
        for (int[] e : edges) {
            // an edge inside one group would make a cycle
            if (dsu.unite(e[1], e[2])) {
                total += e[0];
                used++;
                // a tree on n points has n - 1 edges
                if (used == n - 1) break;
            }
        }
        return total;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minCostConnectPoints(new int[][] {{0, 0}, {2, 2}, {3, 10}, {5, 2}, {7, 0}}) == 20, "example 1");
        check(s.minCostConnectPoints(new int[][] {{3, 12}, {-2, 5}, {-4, 1}}) == 18, "example 2");
        check(s.minCostConnectPoints(new int[][] {{0, 0}}) == 0, "single");
        check(s.minCostConnectPoints(new int[][] {{0, 0}, {1, 1}, {1, 0}, {-1, 1}}) == 4, "four points");
        // many equal edges: any choice gives the same total
        check(s.minCostConnectPoints(new int[][] {{0, 0}, {0, 1}, {1, 0}, {1, 1}}) == 3, "ties");
    }
}
