# ---- code ----
def permute(nums: list[int]) -> list[list[int]]:
    out: list[list[int]] = []
    path: list[int] = []
    used = [False] * len(nums)

    def backtrack() -> None:
        # a full-length path is one permutation
        if len(path) == len(nums):
            out.append(path[:])
            return
        # any unused element can go next, so start from 0
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            backtrack()
            # undo both changes before trying the next i
            path.pop()
            used[i] = False

    backtrack()
    return out
# ---- checks ----
want = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]
assert sorted(permute([1, 2, 3])) == want
assert sorted(permute([0, 1])) == [[0, 1], [1, 0]]
assert permute([1]) == [[1]]
# n! results, all different, each a rearrangement of nums
six = permute([5, -1, 0, 7, 2, 9])
assert len(six) == 720
assert len({tuple(p) for p in six}) == 720
assert all(sorted(p) == [-1, 0, 2, 5, 7, 9] for p in six)
