# ---- code ----
def count_max_or_subsets(nums: list[int]) -> int:
    n = len(nums)
    # OR only adds bits, so the OR of everything is the max
    best = 0
    for x in nums:
        best |= x
    count = 0
    # each mask from 1 to 2^n - 1 is one non-empty subset:
    # bit i set means nums[i] is in it
    for mask in range(1, 1 << n):
        acc = 0
        for i in range(n):
            if (mask >> i) & 1:
                acc |= nums[i]
        if acc == best:
            count += 1
    return count
# ---- checks ----
assert count_max_or_subsets([3, 1]) == 2
assert count_max_or_subsets([2, 2, 2]) == 7
assert count_max_or_subsets([3, 2, 1, 5]) == 6
assert count_max_or_subsets([5]) == 1
# every bit is in one number only: all of them are needed
assert count_max_or_subsets([1, 2, 4]) == 1
# the max OR is 0: every non-empty subset counts, not the empty one
assert count_max_or_subsets([0, 0]) == 3
# 16 numbers: 2^16 - 1 non-empty subsets, all with OR 1
assert count_max_or_subsets([1] * 16) == 65535
