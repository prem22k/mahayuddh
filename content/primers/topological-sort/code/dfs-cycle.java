import java.util.*;
// ---- code ----
class Solution {
    private List<List<Integer>> graph;
    // 0 = not visited, 1 = on the current path, 2 = done
    private int[] state;

    public boolean canFinish(int numCourses,
                             int[][] prerequisites) {
        graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) {
            graph.add(new ArrayList<>());
        }
        for (int[] p : prerequisites) graph.get(p[1]).add(p[0]);
        state = new int[numCourses];
        for (int u = 0; u < numCourses; u++) {
            if (hasCycle(u)) return false;
        }
        return true;
    }

    // true if a cycle can be reached from u
    private boolean hasCycle(int u) {
        if (state[u] == 1) {
            // back on the current path: a cycle
            return true;
        }
        if (state[u] == 2) {
            // fully checked before: no cycle through here
            return false;
        }
        state[u] = 1;
        for (int v : graph.get(u)) {
            if (hasCycle(v)) return true;
        }
        state[u] = 2;
        return false;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.canFinish(2, new int[][] {{1, 0}}), "example 1");
        check(!s.canFinish(2, new int[][] {{1, 0}, {0, 1}}), "example 2");
        check(s.canFinish(1, new int[][] {}), "no edges");
        // a diamond reaches 3 twice, but that is not a cycle
        check(s.canFinish(4, new int[][] {{1, 0}, {2, 0}, {3, 1}, {3, 2}}), "diamond");
        // a course that requires itself
        check(!s.canFinish(1, new int[][] {{0, 0}}), "self loop");
        // the cycle is away from course 0
        check(!s.canFinish(4, new int[][] {{1, 0}, {2, 1}, {3, 2}, {1, 3}}), "cycle after start");
        // two separate parts, both fine
        check(s.canFinish(4, new int[][] {{1, 0}, {3, 2}}), "two parts");
    }
}
