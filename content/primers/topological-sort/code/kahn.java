import java.util.*;
// ---- code ----
class Solution {
    public int[] findOrder(int numCourses,
                           int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) {
            graph.add(new ArrayList<>());
        }
        int[] indegree = new int[numCourses];
        // [a, b] means take b before a: an edge b -> a
        for (int[] p : prerequisites) {
            graph.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }
        // start with every course that needs nothing
        Deque<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) {
            if (indegree[i] == 0) queue.add(i);
        }
        int[] order = new int[numCourses];
        int taken = 0;
        while (!queue.isEmpty()) {
            int u = queue.poll();
            order[taken++] = u;
            for (int v : graph.get(u)) {
                // u is done, so v waits on one course fewer
                indegree[v]--;
                if (indegree[v] == 0) queue.add(v);
            }
        }
        // a cycle keeps its courses above 0 forever
        if (taken < numCourses) return new int[0];
        return order;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static boolean valid(int n, int[][] pre, int[] order) {
        if (order.length != n) return false;
        int[] pos = new int[n];
        Arrays.fill(pos, -1);
        for (int i = 0; i < n; i++) {
            if (order[i] < 0 || order[i] >= n || pos[order[i]] != -1) return false;
            pos[order[i]] = i;
        }
        for (int[] p : pre) if (pos[p[1]] >= pos[p[0]]) return false;
        return true;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        // the walkthrough
        int[][] w = {{1, 0}, {2, 0}, {3, 1}, {3, 2}, {4, 3}, {4, 5}};
        check(Arrays.equals(s.findOrder(6, w), new int[] {0, 5, 1, 2, 3, 4}), "walkthrough");
        check(Arrays.equals(s.findOrder(2, new int[][] {{1, 0}}), new int[] {0, 1}), "example 1");
        int[][] p = {{1, 0}, {2, 0}, {3, 1}, {3, 2}};
        check(valid(4, p, s.findOrder(4, p)), "example 2");
        check(Arrays.equals(s.findOrder(1, new int[][] {}), new int[] {0}), "example 3");
        check(s.findOrder(2, new int[][] {{1, 0}, {0, 1}}).length == 0, "two-cycle");
        // 0 is free, but 1 -> 2 -> 3 -> 1 is a cycle
        check(s.findOrder(4, new int[][] {{1, 0}, {2, 1}, {3, 2}, {1, 3}}).length == 0, "cycle after start");
        // a course that requires itself
        check(s.findOrder(1, new int[][] {{0, 0}}).length == 0, "self loop");
        // no prerequisites at all: every order works
        check(valid(3, new int[][] {}, s.findOrder(3, new int[][] {})), "no edges");
    }
}
