import java.util.*;
// ---- code ----
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

class Solution {
    public int[] findRedundantConnection(int[][] edges) {
        // nodes are 1..n and there are n edges
        DSU dsu = new DSU(edges.length + 1);
        for (int[] e : edges) {
            // already connected: this edge closes a cycle
            if (!dsu.unite(e[0], e[1])) return e;
        }
        return new int[0];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        // the walkthrough
        int[][] w = {{1, 2}, {3, 4}, {2, 4}, {5, 6}, {4, 6}, {1, 5}};
        check(Arrays.equals(s.findRedundantConnection(w), new int[] {1, 5}), "walkthrough");
        check(Arrays.equals(s.findRedundantConnection(new int[][] {{1, 2}, {1, 3}, {2, 3}}), new int[] {2, 3}), "example 1");
        check(Arrays.equals(s.findRedundantConnection(new int[][] {{1, 2}, {2, 3}, {3, 4}, {1, 4}, {1, 5}}),
                            new int[] {1, 4}), "example 2");
        // the cycle closes on the very last edge
        check(Arrays.equals(s.findRedundantConnection(new int[][] {{1, 2}, {2, 3}, {3, 1}}), new int[] {3, 1}), "last edge");

        // the DSU itself: path compression and union by size
        DSU d = new DSU(6);
        check(d.unite(1, 2) && d.unite(3, 4) && d.unite(2, 4), "unions");
        check(d.find(4) == 1 && d.parent[4] == 1, "compressed");
        check(d.size[1] == 4, "size");
        check(!d.unite(3, 2), "same group");
        // a group of 1 hangs under the bigger group's root
        check(d.unite(5, 3) && d.find(5) == 1, "by size");
        check(d.find(0) == 0, "untouched");
    }
}
