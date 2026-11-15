def two_sum(nums: list[int], target: int) -> list[int]:
    # value -> index, for everything left of i
    seen: dict[int, int] = {}
    for i, x in enumerate(nums):
        # 1. is the partner already stored?
        need = target - x
        if need in seen:
            return [seen[need], i]
        # 2. no: store this value for later numbers
        seen[x] = i
    return []
# ---- checks ----
assert two_sum([4, 6, 1, 9, 3, 5], 8) == [4, 5]
assert two_sum([2, 7, 11, 15], 9) == [0, 1]
assert two_sum([3, 3], 6) == [0, 1]
# 3 must not pair with itself
assert two_sum([3, 2, 4], 6) == [1, 2]
assert two_sum([-1, -2, -3, -4, -5], -8) == [2, 4]
assert two_sum([5], 10) == []
assert two_sum([], 1) == []
