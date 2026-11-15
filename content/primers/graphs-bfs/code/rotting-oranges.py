from collections import deque
# ---- code ----
def oranges_rotting(grid: list[list[int]]) -> int:
    rows, cols = len(grid), len(grid[0])
    queue: deque[tuple[int, int]] = deque()
    fresh = 0
    # every rotten orange starts in the queue at minute 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1
    minutes = 0
    while queue and fresh > 0:
        # one round of the loop is one minute
        for _ in range(len(queue)):
            r, c = queue.popleft()
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, nc = r + dr, c + dc
                if (0 <= nr < rows and 0 <= nc < cols
                        and grid[nr][nc] == 1):
                    # rotting it also marks it as seen
                    grid[nr][nc] = 2
                    fresh -= 1
                    queue.append((nr, nc))
        minutes += 1
    return minutes if fresh == 0 else -1
# ---- checks ----
assert oranges_rotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]) == 4
assert oranges_rotting([[2, 1, 1], [0, 1, 1], [1, 0, 1]]) == -1
assert oranges_rotting([[0, 2]]) == 0
# nothing fresh at all: 0 minutes, not -1
assert oranges_rotting([[0]]) == 0
# fresh but nothing rotten: never
assert oranges_rotting([[1]]) == -1
# two sources spread at once and meet in the middle
assert oranges_rotting([[2, 1, 1, 1, 2]]) == 2
assert oranges_rotting([[2, 1, 1, 1, 1]]) == 4
