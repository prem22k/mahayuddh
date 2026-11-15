import java.util.*;
// ---- code ----
class Solution {
    public int minimumObstacles(int[][] grid) {
        int m = grid.length, n = grid[0].length;
        int[][] dist = new int[m][n];
        for (int[] row : dist) {
            Arrays.fill(row, Integer.MAX_VALUE);
        }
        dist[0][0] = 0;
        Deque<int[]> dq = new ArrayDeque<>();
        dq.addLast(new int[]{0, 0});
        int[] dr = {1, -1, 0, 0}, dc = {0, 0, 1, -1};
        while (!dq.isEmpty()) {
            int[] cell = dq.pollFirst();
            int r = cell[0], c = cell[1];
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n) {
                    continue;
                }
                // entering an obstacle costs 1, a free cell 0
                int nd = dist[r][c] + grid[nr][nc];
                if (nd < dist[nr][nc]) {
                    dist[nr][nc] = nd;
                    // cost 0: front of the deque; cost 1: back
                    if (grid[nr][nc] == 0) {
                        dq.addFirst(new int[]{nr, nc});
                    } else {
                        dq.addLast(new int[]{nr, nc});
                    }
                }
            }
        }
        return dist[m - 1][n - 1];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minimumObstacles(new int[][]{{0, 1, 1}, {1, 1, 0}, {1, 1, 0}}) == 2, "example 1");
        check(s.minimumObstacles(new int[][]{{0, 1, 0, 0, 0}, {0, 1, 0, 1, 0}, {0, 0, 0, 1, 0}}) == 0, "example 2");
        check(s.minimumObstacles(new int[][]{{0}}) == 0, "one cell");
        check(s.minimumObstacles(new int[][]{{0, 1}, {1, 0}}) == 1, "two by two");
        // a long free detour beats a short wall
        check(s.minimumObstacles(new int[][]{{0, 1, 0}, {0, 1, 0}, {0, 0, 0}}) == 0, "detour");
        // a wall you must cross somewhere
        check(s.minimumObstacles(new int[][]{{0, 0, 0}, {1, 1, 1}, {0, 0, 0}}) == 1, "wall");
    }
}
