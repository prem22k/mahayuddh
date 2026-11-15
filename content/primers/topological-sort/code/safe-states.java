import java.util.*;
// ---- code ----
class Solution {
    public List<Integer> eventualSafeNodes(int[][] graph) {
        int n = graph.length;
        // flip every edge: parents[v] lists who points at v
        List<List<Integer>> parents = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            parents.add(new ArrayList<>());
        }
        int[] outdegree = new int[n];
        for (int u = 0; u < n; u++) {
            outdegree[u] = graph[u].length;
            for (int v : graph[u]) parents.get(v).add(u);
        }
        // nodes with no way out are safe; peel back from them
        Deque<Integer> queue = new ArrayDeque<>();
        for (int u = 0; u < n; u++) {
            if (outdegree[u] == 0) queue.add(u);
        }
        boolean[] safe = new boolean[n];
        while (!queue.isEmpty()) {
            int v = queue.poll();
            safe[v] = true;
            for (int u : parents.get(v)) {
                outdegree[u]--;
                // every edge out of u now leads to a safe node
                if (outdegree[u] == 0) queue.add(u);
            }
        }
        List<Integer> result = new ArrayList<>();
        for (int u = 0; u < n; u++) {
            if (safe[u]) result.add(u);
        }
        return result;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.eventualSafeNodes(new int[][] {{1, 2}, {2, 3}, {5}, {0}, {5}, {}, {}})
              .equals(List.of(2, 4, 5, 6)), "example 1");
        check(s.eventualSafeNodes(new int[][] {{1, 2, 3, 4}, {1, 2}, {3, 4}, {0, 4}, {}})
              .equals(List.of(4)), "example 2");
        check(s.eventualSafeNodes(new int[][] {{}}).equals(List.of(0)), "single");
        // a node that points at itself is never safe
        check(s.eventualSafeNodes(new int[][] {{0}, {}}).equals(List.of(1)), "self loop");
        // one edge into a cycle is enough to be unsafe
        check(s.eventualSafeNodes(new int[][] {{1, 3}, {2}, {1}, {}}).equals(List.of(3)), "edge into cycle");
        // a chain with no cycle: all safe
        check(s.eventualSafeNodes(new int[][] {{1}, {2}, {3}, {}}).equals(List.of(0, 1, 2, 3)), "chain");
    }
}
