import java.util.*;
// ---- code ----
class Solution {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) {
                // land not sunk yet starts a new island
                if (grid[r][c] == '1') {
                    count++;
                    dfs(grid, r, c);
                }
            }
        }
        return count;
    }

    // sink the whole island that (r, c) belongs to
    private void dfs(char[][] grid, int r, int c) {
        if (r < 0 || r >= grid.length) return;
        if (c < 0 || c >= grid[0].length) return;
        if (grid[r][c] != '1') return;
        // '0' now means water or already visited
        grid[r][c] = '0';
        dfs(grid, r - 1, c);
        dfs(grid, r + 1, c);
        dfs(grid, r, c - 1);
        dfs(grid, r, c + 1);
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static int run(String... rows) {
        char[][] g = new char[rows.length][];
        for (int i = 0; i < rows.length; i++) g[i] = rows[i].toCharArray();
        return new Solution().numIslands(g);
    }

    public static void main(String[] args) {
        check(run("11110", "11010", "11000", "00000") == 1, "example 1");
        check(run("11000", "11000", "00100", "00011") == 3, "example 2");
        check(run("0") == 0, "water");
        check(run("1") == 1, "land");
        // diagonal cells are not connected
        check(run("101", "010", "101") == 5, "diagonals");
        // a U shape is one island, even though a row scan splits it
        check(run("101", "101", "111") == 1, "U shape");
    }
}
