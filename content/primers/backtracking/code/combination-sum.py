# ---- code ----
def combination_sum(
    candidates: list[int], target: int
) -> list[list[int]]:
    # sorted, so one number too big means the rest are too
    nums = sorted(candidates)
    out: list[list[int]] = []
    path: list[int] = []

    def backtrack(start: int, remain: int) -> None:
        if remain == 0:
            out.append(path[:])
            return
        for i in range(start, len(nums)):
            # prune: this branch and every later one overshoot
            if nums[i] > remain:
                break
            path.append(nums[i])
            # i, not i + 1: the same number can be used again
            backtrack(i, remain - nums[i])
            path.pop()

    backtrack(0, target)
    return out
# ---- checks ----
assert sorted(combination_sum([2, 3, 6, 7], 7)) == [[2, 2, 3], [7]]
want = [[2, 2, 2, 2], [2, 3, 3], [3, 5]]
assert sorted(combination_sum([2, 3, 5], 8)) == want
assert combination_sum([2], 1) == []
assert combination_sum([1], 2) == [[1, 1]]
# unsorted input: the early break only works after sorting
assert sorted(combination_sum([7, 3, 2], 7)) == [[2, 2, 3], [7]]
assert sorted(combination_sum([8, 4, 2], 8)) == [
    [2, 2, 2, 2], [2, 2, 4], [4, 4], [8],
]
