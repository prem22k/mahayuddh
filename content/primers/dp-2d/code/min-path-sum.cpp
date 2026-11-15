#include <algorithm>
#include <cassert>
#include <climits>
#include <vector>
using namespace std;
// ---- code ----
int minPathSum(const vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    // state: dp[r][c] = cheapest path to (r, c).
    // Only row r - 1 is ever read, so keep one row: before
    // dp[c] is updated it still holds the cell above
    vector<int> dp(n, INT_MAX);
    // base case: a pretend cell above (0, 0) that costs 0
    dp[0] = 0;
    for (int r = 0; r < m; r++) {
        for (int c = 0; c < n; c++) {
            // left: dp[c - 1], already updated for this row
            int left = c > 0 ? dp[c - 1] : INT_MAX;
            // above: dp[c], still last row's value
            dp[c] = grid[r][c] + min(dp[c], left);
        }
    }
    return dp[n - 1];
}
// ---- checks ----
int main() {
    assert(minPathSum({{1, 3, 1}, {1, 5, 1}, {4, 2, 1}}) == 7);
    assert(minPathSum({{1, 2, 3}, {4, 5, 6}}) == 12);
    assert(minPathSum({{5}}) == 5);
    // one row or one column: only one path
    assert(minPathSum({{1, 2, 3}}) == 6);
    assert(minPathSum({{1}, {2}, {3}}) == 6);
    // the cheap route goes down first, then right
    assert(minPathSum({{1, 9, 9}, {1, 9, 9}, {1, 1, 1}}) == 5);
    assert(minPathSum({{0, 0}, {0, 0}}) == 0);
    return 0;
}
