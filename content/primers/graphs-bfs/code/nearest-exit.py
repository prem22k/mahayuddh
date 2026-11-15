from collections import deque
# ---- code ----
def nearest_exit(maze: list[list[str]],
                 entrance: list[int]) -> int:
    rows, cols = len(maze), len(maze[0])
    seen = [[False] * cols for _ in range(rows)]
    r0, c0 = entrance
    queue = deque([(r0, c0)])
    # mark it seen when it joins the queue, not later
    seen[r0][c0] = True
    steps = 0
    while queue:
        # everything in the queue now is `steps` moves away
        for _ in range(len(queue)):
            r, c = queue.popleft()
            edge = r in (0, rows - 1) or c in (0, cols - 1)
            if edge and (r, c) != (r0, c0):
                return steps
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, nc = r + dr, c + dc
                if (0 <= nr < rows and 0 <= nc < cols
                        and maze[nr][nc] == "."
                        and not seen[nr][nc]):
                    seen[nr][nc] = True
                    queue.append((nr, nc))
        steps += 1
    return -1
# ---- checks ----
def grid(*rows: str) -> list[list[str]]:
    return [list(r) for r in rows]


# the walkthrough: (2, 1) is a dead end, the exit is (2, 5)
assert nearest_exit(grid("++++++", "+....+", "+.++..", "++++++"),
                    [1, 1]) == 5
assert nearest_exit(grid("++.+", "...+", "+++."), [1, 2]) == 1
assert nearest_exit(grid("+++", "...", "+++"), [1, 0]) == 2
# the entrance itself never counts as an exit
assert nearest_exit(grid(".+"), [0, 0]) == -1
assert nearest_exit(grid("..."), [0, 0]) == 1
# walled in: no way out
assert nearest_exit(grid("+++", "+.+", "+++"), [1, 1]) == -1
# two exits, 4 and 5 moves away: BFS finds the nearer
assert nearest_exit(grid("+++++", "+...+", "+.+..", "+...+",
                         "+++.+"), [1, 1]) == 4
