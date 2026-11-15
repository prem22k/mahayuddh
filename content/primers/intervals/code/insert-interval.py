# ---- code ----
def insert(
    intervals: list[list[int]], new_interval: list[int]
) -> list[list[int]]:
    out = []
    i, n = 0, len(intervals)
    # 1. ends before new starts: copy it
    while i < n and intervals[i][1] < new_interval[0]:
        out.append(intervals[i])
        i += 1
    # 2. starts before new ends: absorb it into new
    start, end = new_interval
    while i < n and intervals[i][0] <= end:
        start = min(start, intervals[i][0])
        end = max(end, intervals[i][1])
        i += 1
    out.append([start, end])
    # 3. everything left starts after new ends
    while i < n:
        out.append(intervals[i])
        i += 1
    return out
# ---- checks ----
assert insert([[1, 3], [6, 9]], [2, 5]) == [[1, 5], [6, 9]]
assert insert([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]) == [
    [1, 2], [3, 10], [12, 16]]
assert insert([], [5, 7]) == [[5, 7]]
# goes first, goes last, touches a neighbour
assert insert([[3, 4]], [1, 2]) == [[1, 2], [3, 4]]
assert insert([[1, 2]], [3, 4]) == [[1, 2], [3, 4]]
assert insert([[1, 5]], [5, 7]) == [[1, 7]]
# new swallows everything
assert insert([[2, 3], [4, 5], [6, 7]], [1, 9]) == [[1, 9]]
