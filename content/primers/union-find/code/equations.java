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
    public boolean equationsPossible(String[] equations) {
        DSU dsu = new DSU(26);
        // pass 1: join every pair that must be equal
        for (String e : equations) {
            if (e.charAt(1) == '=') {
                int x = e.charAt(0) - 'a';
                int y = e.charAt(3) - 'a';
                dsu.unite(x, y);
            }
        }
        // pass 2: no "!=" may sit inside one group
        for (String e : equations) {
            if (e.charAt(1) == '!') {
                int x = e.charAt(0) - 'a';
                int y = e.charAt(3) - 'a';
                if (dsu.find(x) == dsu.find(y)) return false;
            }
        }
        return true;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(!s.equationsPossible(new String[] {"a==b", "b!=a"}), "example 1");
        check(s.equationsPossible(new String[] {"b==a", "a==b"}), "example 2");
        check(!s.equationsPossible(new String[] {"a!=a"}), "a!=a");
        check(s.equationsPossible(new String[] {"a==a"}), "a==a");
        // the "!=" comes first, so one pass would miss it
        check(!s.equationsPossible(new String[] {"a!=b", "b==c", "c==a"}), "order");
        // equality chains through c
        check(!s.equationsPossible(new String[] {"a==c", "c==b", "a!=b"}), "chain");
        check(s.equationsPossible(new String[] {"a==b", "c==d", "a!=d"}), "two groups");
    }
}
