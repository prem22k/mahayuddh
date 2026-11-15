import java.util.*;
// ---- code ----
class Solution {
    public int minimumEffortPath(int[][] heights) {
        int m = heights.length, n = heights[0].length;
        int[][] effort = new int[m][n];
        for (int[] row : effort) {
            Arrays.fill(row, Integer.MAX_VALUE);
        }
        effort[0][0] = 0;
        // (worst step on the path so far, row, col)
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> Integer.compare(a[0], b[0]));
        heap.offer(new int[]{0, 0, 0});
        int[] dr = {1, -1, 0, 0}, dc = {0, 0, 1, -1};
        while (!heap.isEmpty()) {
            int[] top = heap.poll();
            int e = top[0], r = top[1], c = top[2];
            if (e > effort[r][c]) continue;
            // the first time the corner pops, it is final
            if (r == m - 1 && c == n - 1) return e;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n) {
                    continue;
                }
                int step = Math.abs(
                    heights[nr][nc] - heights[r][c]);
                // a path costs its worst step, not the sum
                int ne = Math.max(e, step);
                if (ne < effort[nr][nc]) {
                    effort[nr][nc] = ne;
                    heap.offer(new int[]{ne, nr, nc});
                }
            }
        }
        return 0;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minimumEffortPath(new int[][]{{1, 2, 2}, {3, 8, 2}, {5, 3, 5}}) == 2, "example 1");
        check(s.minimumEffortPath(new int[][]{{1, 2, 3}, {3, 8, 4}, {5, 3, 5}}) == 1, "example 2");
        int[][] flat = {
            {1, 2, 1, 1, 1},
            {1, 2, 1, 2, 1},
            {1, 2, 1, 2, 1},
            {1, 2, 1, 2, 1},
            {1, 1, 1, 2, 1}};
        check(s.minimumEffortPath(flat) == 0, "example 3");
        check(s.minimumEffortPath(new int[][]{{5}}) == 0, "one cell");
        check(s.minimumEffortPath(new int[][]{{1, 10}}) == 9, "one step");
        // the lowest sum goes down the left (worst step 6);
        // the lowest worst step goes along the top (4)
        check(s.minimumEffortPath(new int[][]{{1, 3, 5}, {1, 9, 9}, {1, 1, 7}}) == 4, "max not sum");
        check(s.minimumEffortPath(new int[][]{{1, 100, 1}, {3, 100, 4}, {5, 7, 9}}) == 2, "around the wall");
    }
}
