# ---- code ----
def erase_overlap_intervals(intervals: list[list[int]]) -> int:
    # earliest end first: it leaves the most room after it
    intervals.sort(key=lambda iv: iv[1])
    removed = 0
    end = float("-inf")
    for start, finish in intervals:
        if start >= end:
            # fits after the last kept interval: keep it
            end = finish
        else:
            # clashes with one that ends sooner: drop it
            removed += 1
    return removed
# ---- checks ----
assert erase_overlap_intervals([[1, 10], [2, 3], [4, 5], [6, 7]]) == 1
assert erase_overlap_intervals([[1, 2], [2, 3], [3, 4], [1, 3]]) == 1
assert erase_overlap_intervals([[1, 2], [1, 2], [1, 2]]) == 2
assert erase_overlap_intervals([[1, 2], [2, 3]]) == 0
assert erase_overlap_intervals([[5, 9]]) == 0
# sorting by start would keep [1, 100] and lose two
assert erase_overlap_intervals([[1, 100], [11, 22], [1, 11], [2, 12]]) == 2
assert erase_overlap_intervals([[-3, 0], [-1, 1], [0, 2], [1, 3]]) == 2
