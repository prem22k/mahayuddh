# ---- code ----
def min_groups(intervals: list[list[int]]) -> int:
    events = []
    for left, right in intervals:
        events.append((left, 1))
        # ends are inclusive: it's gone from right + 1 on
        events.append((right + 1, -1))
    # by time; at a tie, -1 sorts first, so ends go first
    events.sort()
    active = best = 0
    for _, delta in events:
        active += delta
        # most intervals alive at one moment
        best = max(best, active)
    return best
# ---- checks ----
assert min_groups([[5, 10], [6, 8], [1, 5], [2, 3], [1, 10]]) == 3
assert min_groups([[1, 3], [5, 6], [8, 10], [11, 13]]) == 1
assert min_groups([[1, 1]]) == 1
# sharing one point is still an overlap here
assert min_groups([[1, 2], [2, 3]]) == 2
# right + 1 meets the next start: no overlap
assert min_groups([[1, 2], [3, 4], [1, 2]]) == 2
assert min_groups([[1, 5], [1, 5], [1, 5]]) == 3
