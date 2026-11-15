# ---- code ----
def can_partition(nums: list[int]) -> bool:
    total = sum(nums)
    # an odd total can't split into two equal halves
    if total % 2 == 1:
        return False
    target = total // 2
    # state: dp[i][s] = some of the first i items sum to s.
    # Row i only reads row i - 1, so keep a single row
    can = [False] * (target + 1)
    # base case: the empty choice sums to 0
    can[0] = True
    for x in nums:
        # right to left: can[s - x] is still last row's value,
        # so x is used at most once
        for s in range(target, x - 1, -1):
            if can[s - x]:
                can[s] = True
    return can[target]
# ---- checks ----
assert can_partition([1, 5, 11, 5]) is True
assert can_partition([1, 2, 3, 5]) is False
assert can_partition([1, 1]) is True
assert can_partition([100]) is False
assert can_partition([2, 2, 1, 1]) is True
# odd total
assert can_partition([1, 2]) is False
# left to right would reuse 1 to make 4 = 1 + 1 + 2
assert can_partition([1, 2, 5]) is False
# a number bigger than the target is just skipped
assert can_partition([3, 3, 3, 3, 12]) is True
