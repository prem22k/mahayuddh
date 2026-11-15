# ---- code ----
def rob(nums: list[int]) -> int:
    n = len(nums)
    # state: dp[i] = the most from the first i houses
    dp = [0] * (n + 1)
    # base cases: no houses gives 0, one house gives itself
    if n > 0:
        dp[1] = nums[0]
    # order: left to right, as dp[i] reads i - 1 and i - 2
    for i in range(2, n + 1):
        # skip house i, or rob it and add dp[i - 2]
        dp[i] = max(dp[i - 1], dp[i - 2] + nums[i - 1])
    return dp[n]
# ---- checks ----
assert rob([2, 7, 9, 3, 1]) == 12
assert rob([1, 2, 3, 1]) == 4
assert rob([5]) == 5
assert rob([]) == 0
assert rob([0, 0]) == 0
# the best skips two houses in a row: 2 + 2, not 2 + 1
assert rob([2, 1, 1, 2]) == 4
# taking every other house from the start isn't always best
assert rob([1, 9, 1, 1, 9]) == 18
