# ---- code ----
def min_path_sum(grid: list[list[int]]) -> int:
    m, n = len(grid), len(grid[0])
    inf = float("inf")
    # state: dp[r][c] = cheapest path to (r, c).
    # Only row r - 1 is ever read, so keep one row: before
    # dp[c] is updated it still holds the cell above
    dp = [inf] * n
    # base case: a pretend cell above (0, 0) that costs 0
    dp[0] = 0
    for r in range(m):
        for c in range(n):
            # left: dp[c - 1], already updated for this row
            left = dp[c - 1] if c > 0 else inf
            # above: dp[c], still last row's value
            dp[c] = grid[r][c] + min(dp[c], left)
    return dp[n - 1]
# ---- checks ----
assert min_path_sum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]) == 7
assert min_path_sum([[1, 2, 3], [4, 5, 6]]) == 12
assert min_path_sum([[5]]) == 5
# one row or one column: only one path
assert min_path_sum([[1, 2, 3]]) == 6
assert min_path_sum([[1], [2], [3]]) == 6
# the cheap route goes down first, then right
assert min_path_sum([[1, 9, 9], [1, 9, 9], [1, 1, 1]]) == 5
assert min_path_sum([[0, 0], [0, 0]]) == 0
