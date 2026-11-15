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
    public int makeConnected(int n, int[][] connections) {
        // joining n computers needs at least n - 1 cables
        if (connections.length < n - 1) return -1;
        DSU dsu = new DSU(n);
        int groups = n;
        for (int[] c : connections) {
            // each real merge turns two groups into one
            if (dsu.unite(c[0], c[1])) groups--;
        }
        // one moved cable joins two groups
        return groups - 1;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.makeConnected(4, new int[][] {{0, 1}, {0, 2}, {1, 2}}) == 1, "example 1");
        check(s.makeConnected(6, new int[][] {{0, 1}, {0, 2}, {0, 3}, {1, 2}, {1, 3}}) == 2, "example 2");
        check(s.makeConnected(6, new int[][] {{0, 1}, {0, 2}, {0, 3}, {1, 2}}) == -1, "example 3");
        // already connected
        check(s.makeConnected(3, new int[][] {{0, 1}, {1, 2}}) == 0, "connected");
        check(s.makeConnected(1, new int[][] {}) == 0, "single");
        // enough cables, but all inside one group: move them
        check(s.makeConnected(5, new int[][] {{0, 1}, {1, 2}, {2, 0}, {0, 3}}) == 1, "spare cable");
    }
}
