import java.util.*;
// ---- code ----
class Solution {
    public int minPathSum(int[][] grid) {
        int m = grid.length, n = grid[0].length;
        // state: dp[r][c] = cheapest path to (r, c).
        // Only row r - 1 is ever read, so keep one row: before
        // dp[c] is updated it still holds the cell above
        int[] dp = new int[n];
        Arrays.fill(dp, Integer.MAX_VALUE);
        // base case: a pretend cell above (0, 0) that costs 0
        dp[0] = 0;
        for (int r = 0; r < m; r++) {
            for (int c = 0; c < n; c++) {
                // left: dp[c - 1], already updated for this row
                int left = c > 0 ? dp[c - 1]
                                 : Integer.MAX_VALUE;
                // above: dp[c], still last row's value
                dp[c] = grid[r][c] + Math.min(dp[c], left);
            }
        }
        return dp[n - 1];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minPathSum(new int[][]{{1, 3, 1}, {1, 5, 1}, {4, 2, 1}}) == 7, "example 1");
        check(s.minPathSum(new int[][]{{1, 2, 3}, {4, 5, 6}}) == 12, "example 2");
        check(s.minPathSum(new int[][]{{5}}) == 5, "one cell");
        // one row or one column: only one path
        check(s.minPathSum(new int[][]{{1, 2, 3}}) == 6, "one row");
        check(s.minPathSum(new int[][]{{1}, {2}, {3}}) == 6, "one column");
        // the cheap route goes down first, then right
        check(s.minPathSum(new int[][]{{1, 9, 9}, {1, 9, 9}, {1, 1, 1}}) == 5, "down then right");
        check(s.minPathSum(new int[][]{{0, 0}, {0, 0}}) == 0, "zeros");
    }
}
