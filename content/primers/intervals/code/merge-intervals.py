# ---- code ----
def merge(intervals: list[list[int]]) -> list[list[int]]:
    # sort by start: overlaps end up side by side
    intervals.sort(key=lambda iv: iv[0])
    merged = []
    for start, end in intervals:
        # starts after the last block ends: a new block
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            # overlaps: grow the end, never shrink it
            merged[-1][1] = max(merged[-1][1], end)
    return merged
# ---- checks ----
assert merge([[2, 3], [1, 5], [6, 8], [7, 7]]) == [[1, 5], [6, 8]]
assert merge([[1, 3], [2, 6], [8, 10], [15, 18]]) == [
    [1, 6], [8, 10], [15, 18]]
# touching ends count as overlapping
assert merge([[1, 4], [4, 5]]) == [[1, 5]]
assert merge([[1, 4]]) == [[1, 4]]
# unsorted input, and one interval swallows the rest
assert merge([[4, 7], [1, 10], [2, 3]]) == [[1, 10]]
assert merge([[5, 6], [1, 2], [3, 4]]) == [[1, 2], [3, 4], [5, 6]]
