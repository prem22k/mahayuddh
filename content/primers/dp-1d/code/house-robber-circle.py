# ---- code ----
def rob(nums: list[int]) -> int:
    n = len(nums)
    # one house has no neighbour, so take it
    if n == 1:
        return nums[0]

    def rob_line(lo: int, hi: int) -> int:
        # houses lo .. hi - 1 in a row. dp[i] only reads
        # dp[i - 1] and dp[i - 2], so keep just those two
        prev2, prev1 = 0, 0
        for i in range(lo, hi):
            cur = max(prev1, prev2 + nums[i])
            prev2, prev1 = prev1, cur
        return prev1

    # first and last are neighbours: leave one of them out
    return max(rob_line(0, n - 1), rob_line(1, n))
# ---- checks ----
assert rob([2, 3, 2]) == 3
assert rob([1, 2, 3, 1]) == 4
assert rob([1, 2, 3]) == 3
assert rob([5]) == 5
assert rob([4, 9]) == 9
# the answer drops the first house
assert rob([1, 3, 1, 3, 100]) == 103
# the answer drops the last house
assert rob([200, 3, 140, 20, 10]) == 340
