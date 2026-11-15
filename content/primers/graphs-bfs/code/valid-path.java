import java.util.*;
// ---- code ----
class Solution {
    public boolean validPath(int n, int[][] edges,
                             int source, int destination) {
        // adjacency list: graph.get(u) holds u's neighbours
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            graph.add(new ArrayList<>());
        }
        for (int[] e : edges) {
            graph.get(e[0]).add(e[1]);
            graph.get(e[1]).add(e[0]);
        }
        boolean[] seen = new boolean[n];
        seen[source] = true;
        // a stack makes this DFS; a queue would make it BFS
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(source);
        while (!stack.isEmpty()) {
            int u = stack.pop();
            if (u == destination) return true;
            for (int v : graph.get(u)) {
                if (!seen[v]) {
                    seen[v] = true;
                    stack.push(v);
                }
            }
        }
        return false;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.validPath(3, new int[][] {{0, 1}, {1, 2}, {2, 0}}, 0, 2), "example 1");
        check(!s.validPath(6, new int[][] {{0, 1}, {0, 2}, {3, 5}, {5, 4}, {4, 3}}, 0, 5), "example 2");
        check(s.validPath(1, new int[][] {}, 0, 0), "single node");
        // edges go both ways
        check(s.validPath(2, new int[][] {{1, 0}}, 0, 1), "undirected");
        // a cycle must not loop forever
        check(!s.validPath(4, new int[][] {{0, 1}, {1, 2}, {2, 0}}, 0, 3), "cycle");
        // a long chain
        int[][] chain = new int[999][];
        for (int i = 0; i < 999; i++) chain[i] = new int[] {i, i + 1};
        check(s.validPath(1000, chain, 0, 999), "chain");
    }
}
