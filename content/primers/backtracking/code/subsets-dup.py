# ---- code ----
def subsets_with_dup(nums: list[int]) -> list[list[int]]:
    # sorting puts equal values next to each other
    nums = sorted(nums)
    out: list[list[int]] = []
    path: list[int] = []

    def backtrack(start: int) -> None:
        out.append(path[:])
        for i in range(start, len(nums)):
            # same value as the last choice at this depth:
            # its whole subtree was already built, so skip it
            if i > start and nums[i] == nums[i - 1]:
                continue
            path.append(nums[i])
            backtrack(i + 1)
            path.pop()

    backtrack(0)
    return out
# ---- checks ----
want = [[], [1], [1, 2], [1, 2, 2], [2], [2, 2]]
assert sorted(subsets_with_dup([1, 2, 2])) == want
assert sorted(subsets_with_dup([0])) == [[], [0]]
# all equal: one subset per count, 0 to 3
assert sorted(subsets_with_dup([5, 5, 5])) == [
    [], [5], [5, 5], [5, 5, 5],
]
# unsorted input: the skip only sees duplicates after sorting
got = subsets_with_dup([4, 4, 4, 1, 4])
assert len(got) == 10
assert len({tuple(s) for s in got}) == 10
assert sorted(got) == sorted([
    [], [1], [1, 4], [1, 4, 4], [1, 4, 4, 4], [1, 4, 4, 4, 4],
    [4], [4, 4], [4, 4, 4], [4, 4, 4, 4],
])
