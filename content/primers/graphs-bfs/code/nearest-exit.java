import java.util.*;
// ---- code ----
class Solution {
    public int nearestExit(char[][] maze, int[] entrance) {
        int rows = maze.length, cols = maze[0].length;
        boolean[][] seen = new boolean[rows][cols];
        int r0 = entrance[0], c0 = entrance[1];
        Deque<int[]> queue = new ArrayDeque<>();
        queue.add(new int[] {r0, c0});
        // mark it seen when it joins the queue, not later
        seen[r0][c0] = true;
        int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        int steps = 0;
        while (!queue.isEmpty()) {
            // everything in the queue now is `steps` moves away
            for (int k = queue.size(); k > 0; k--) {
                int[] cell = queue.poll();
                int r = cell[0], c = cell[1];
                boolean edge = r == 0 || r == rows - 1
                            || c == 0 || c == cols - 1;
                if (edge && !(r == r0 && c == c0)) return steps;
                for (int[] d : dirs) {
                    int nr = r + d[0], nc = c + d[1];
                    if (nr >= 0 && nr < rows
                            && nc >= 0 && nc < cols
                            && maze[nr][nc] == '.'
                            && !seen[nr][nc]) {
                        seen[nr][nc] = true;
                        queue.add(new int[] {nr, nc});
                    }
                }
            }
            steps++;
        }
        return -1;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static int run(int r, int c, String... rows) {
        char[][] g = new char[rows.length][];
        for (int i = 0; i < rows.length; i++) g[i] = rows[i].toCharArray();
        return new Solution().nearestExit(g, new int[] {r, c});
    }

    public static void main(String[] args) {
        // the walkthrough: (2, 1) is a dead end, the exit is (2, 5)
        check(run(1, 1, "++++++", "+....+", "+.++..", "++++++") == 5, "walkthrough");
        check(run(1, 2, "++.+", "...+", "+++.") == 1, "example 1");
        check(run(1, 0, "+++", "...", "+++") == 2, "example 2");
        // the entrance itself never counts as an exit
        check(run(0, 0, ".+") == -1, "example 3");
        check(run(0, 0, "...") == 1, "one row");
        // walled in: no way out
        check(run(1, 1, "+++", "+.+", "+++") == -1, "walled in");
        // two exits, 4 and 5 moves away: BFS finds the nearer
        check(run(1, 1, "+++++", "+...+", "+.+..", "+...+", "+++.+") == 4, "nearer exit");
    }
}
