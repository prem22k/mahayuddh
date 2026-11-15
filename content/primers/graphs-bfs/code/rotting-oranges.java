import java.util.*;
// ---- code ----
class Solution {
    public int orangesRotting(int[][] grid) {
        int rows = grid.length, cols = grid[0].length;
        Deque<int[]> queue = new ArrayDeque<>();
        int fresh = 0;
        // every rotten orange starts in the queue at minute 0
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == 2) {
                    queue.add(new int[] {r, c});
                } else if (grid[r][c] == 1) {
                    fresh++;
                }
            }
        }
        int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        int minutes = 0;
        while (!queue.isEmpty() && fresh > 0) {
            // one round of the loop is one minute
            for (int k = queue.size(); k > 0; k--) {
                int[] cell = queue.poll();
                int r = cell[0], c = cell[1];
                for (int[] d : dirs) {
                    int nr = r + d[0], nc = c + d[1];
                    if (nr >= 0 && nr < rows
                            && nc >= 0 && nc < cols
                            && grid[nr][nc] == 1) {
                        // rotting it also marks it as seen
                        grid[nr][nc] = 2;
                        fresh--;
                        queue.add(new int[] {nr, nc});
                    }
                }
            }
            minutes++;
        }
        return fresh == 0 ? minutes : -1;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.orangesRotting(new int[][] {{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}) == 4, "example 1");
        check(s.orangesRotting(new int[][] {{2, 1, 1}, {0, 1, 1}, {1, 0, 1}}) == -1, "example 2");
        check(s.orangesRotting(new int[][] {{0, 2}}) == 0, "example 3");
        // nothing fresh at all: 0 minutes, not -1
        check(s.orangesRotting(new int[][] {{0}}) == 0, "empty");
        // fresh but nothing rotten: never
        check(s.orangesRotting(new int[][] {{1}}) == -1, "no source");
        // two sources spread at once and meet in the middle
        check(s.orangesRotting(new int[][] {{2, 1, 1, 1, 2}}) == 2, "two sources");
        check(s.orangesRotting(new int[][] {{2, 1, 1, 1, 1}}) == 4, "one source");
    }
}
