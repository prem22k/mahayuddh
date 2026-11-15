from collections import deque
# ---- code ----
def minimum_obstacles(grid: list[list[int]]) -> int:
    m, n = len(grid), len(grid[0])
    inf = float("inf")
    dist = [[inf] * n for _ in range(m)]
    dist[0][0] = 0
    dq = deque([(0, 0)])
    while dq:
        r, c = dq.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < m and 0 <= nc < n):
                continue
            # entering an obstacle costs 1, a free cell 0
            nd = dist[r][c] + grid[nr][nc]
            if nd < dist[nr][nc]:
                dist[nr][nc] = nd
                # cost 0: front of the deque; cost 1: back
                if grid[nr][nc] == 0:
                    dq.appendleft((nr, nc))
                else:
                    dq.append((nr, nc))
    return dist[m - 1][n - 1]
# ---- checks ----
assert minimum_obstacles([[0, 1, 1], [1, 1, 0], [1, 1, 0]]) == 2
assert minimum_obstacles([[0, 1, 0, 0, 0], [0, 1, 0, 1, 0], [0, 0, 0, 1, 0]]) == 0
assert minimum_obstacles([[0]]) == 0
assert minimum_obstacles([[0, 1], [1, 0]]) == 1
# a long free detour beats a short wall
detour = [[0, 1, 0], [0, 1, 0], [0, 0, 0]]
assert minimum_obstacles(detour) == 0
# a wall you must cross somewhere
wall = [[0, 0, 0], [1, 1, 1], [0, 0, 0]]
assert minimum_obstacles(wall) == 1
