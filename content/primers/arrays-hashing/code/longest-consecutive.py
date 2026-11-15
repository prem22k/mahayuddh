def longest_consecutive(nums: list[int]) -> int:
    present = set(nums)
    best = 0
    for x in present:
        # only count from the first number of a run
        if x - 1 in present:
            continue
        length = 1
        while x + length in present:
            length += 1
        best = max(best, length)
    return best
# ---- checks ----
assert longest_consecutive([100, 4, 200, 1, 3, 2]) == 4
assert longest_consecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]) == 9
assert longest_consecutive([]) == 0
assert longest_consecutive([5]) == 1
# duplicates don't lengthen a run
assert longest_consecutive([1, 2, 0, 1]) == 3
assert longest_consecutive([-1, 0, 1, 10]) == 3
