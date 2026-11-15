def build_prefix(nums: list[int]) -> list[int]:
    # pre[i] = sum of the first i numbers; pre[0] = 0
    pre = [0] * (len(nums) + 1)
    for i, x in enumerate(nums):
        pre[i + 1] = pre[i] + x
    return pre

def range_sum(pre: list[int], left: int, right: int) -> int:
    # sum of nums[left..right], both ends included
    return pre[right + 1] - pre[left]
# ---- checks ----
pre = build_prefix([-2, 0, 3, -5, 2, -1])
assert pre == [0, -2, -2, 1, -4, -2, -3]
assert range_sum(pre, 0, 2) == 1
assert range_sum(pre, 2, 5) == -1
assert range_sum(pre, 0, 5) == -3
assert range_sum(pre, 3, 3) == -5
assert range_sum(build_prefix([7]), 0, 0) == 7
assert build_prefix([]) == [0]
