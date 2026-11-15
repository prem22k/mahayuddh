import java.util.*;
// ---- code ----
class Solution {
    public int minimumTime(int n, int[][] relations,
                           int[] time) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            graph.add(new ArrayList<>());
        }
        int[] indegree = new int[n];
        // courses are 1..n; [a, b] means a before b
        for (int[] r : relations) {
            graph.get(r[0] - 1).add(r[1] - 1);
            indegree[r[1] - 1]++;
        }
        // start[v]: the earliest month v can begin
        int[] start = new int[n];
        Deque<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < n; i++) {
            if (indegree[i] == 0) queue.add(i);
        }
        int best = 0;
        while (!queue.isEmpty()) {
            int u = queue.poll();
            int finish = start[u] + time[u];
            best = Math.max(best, finish);
            for (int v : graph.get(u)) {
                // v waits for its slowest prerequisite
                start[v] = Math.max(start[v], finish);
                indegree[v]--;
                if (indegree[v] == 0) queue.add(v);
            }
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minimumTime(3, new int[][] {{1, 3}, {2, 3}}, new int[] {3, 2, 5}) == 8, "example 1");
        check(s.minimumTime(5, new int[][] {{1, 5}, {2, 5}, {3, 5}, {3, 4}, {4, 5}},
                            new int[] {1, 2, 3, 4, 5}) == 12, "example 2");
        check(s.minimumTime(1, new int[][] {}, new int[] {7}) == 7, "single");
        // no relations: everything runs at once, the longest wins
        check(s.minimumTime(3, new int[][] {}, new int[] {1, 5, 2}) == 5, "no relations");
        // the slow branch decides, not the one with more courses
        check(s.minimumTime(4, new int[][] {{1, 2}, {2, 3}, {1, 4}}, new int[] {1, 1, 1, 9}) == 10, "slow branch");
    }
}
