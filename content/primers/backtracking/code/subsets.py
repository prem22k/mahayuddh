# ---- code ----
def subsets(nums: list[int]) -> list[list[int]]:
    out: list[list[int]] = []
    path: list[int] = []

    def backtrack(start: int) -> None:
        # every node of the tree is a subset: record a copy
        out.append(path[:])
        for i in range(start, len(nums)):
            # choose nums[i]
            path.append(nums[i])
            # only later indexes, so each set appears once
            backtrack(i + 1)
            # un-choose: the next i starts from the same path
            path.pop()

    backtrack(0)
    return out
# ---- checks ----
# the walkthrough's order, exactly as the recursion records it
assert subsets([1, 2, 3]) == [
    [], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3],
]
assert sorted(subsets([0])) == [[], [0]]
assert subsets([]) == [[]]
# 2^n subsets, all different
ten = subsets(list(range(10)))
assert len(ten) == 1024
assert len({tuple(s) for s in ten}) == 1024
# negatives and unsorted input keep their input order
got = sorted(subsets([3, -1]))
assert got == sorted([[], [3], [-1], [3, -1]])
