import heapq
# ---- code ----
def minimum_effort_path(heights: list[list[int]]) -> int:
    m, n = len(heights), len(heights[0])
    inf = float("inf")
    effort = [[inf] * n for _ in range(m)]
    effort[0][0] = 0
    # (worst step on the path so far, row, col)
    heap = [(0, 0, 0)]
    while heap:
        e, r, c = heapq.heappop(heap)
        if e > effort[r][c]:
            continue
        # the first time the corner pops, it is final
        if r == m - 1 and c == n - 1:
            return e
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < m and 0 <= nc < n):
                continue
            step = abs(heights[nr][nc] - heights[r][c])
            # a path costs its worst step, not the sum
            ne = max(e, step)
            if ne < effort[nr][nc]:
                effort[nr][nc] = ne
                heapq.heappush(heap, (ne, nr, nc))
    return 0
# ---- checks ----
assert minimum_effort_path([[1, 2, 2], [3, 8, 2], [5, 3, 5]]) == 2
assert minimum_effort_path([[1, 2, 3], [3, 8, 4], [5, 3, 5]]) == 1
flat = [
    [1, 2, 1, 1, 1],
    [1, 2, 1, 2, 1],
    [1, 2, 1, 2, 1],
    [1, 2, 1, 2, 1],
    [1, 1, 1, 2, 1],
]
assert minimum_effort_path(flat) == 0
assert minimum_effort_path([[5]]) == 0
assert minimum_effort_path([[1, 10]]) == 9
# the lowest sum goes down the left (worst step 6);
# the lowest worst step goes along the top (4)
assert minimum_effort_path([[1, 3, 5], [1, 9, 9], [1, 1, 7]]) == 4
assert minimum_effort_path([[1, 100, 1], [3, 100, 4], [5, 7, 9]]) == 2
