# ---- code ----
def num_islands(grid: list[list[str]]) -> int:
    rows, cols = len(grid), len(grid[0])

    # sink the whole island that (r, c) belongs to
    def dfs(r: int, c: int) -> None:
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return
        if grid[r][c] != "1":
            return
        # "0" now means water or already visited
        grid[r][c] = "0"
        dfs(r - 1, c)
        dfs(r + 1, c)
        dfs(r, c - 1)
        dfs(r, c + 1)

    count = 0
    for r in range(rows):
        for c in range(cols):
            # land not sunk yet starts a new island
            if grid[r][c] == "1":
                count += 1
                dfs(r, c)
    return count
# ---- checks ----
def grid(*rows: str) -> list[list[str]]:
    return [list(r) for r in rows]


assert num_islands(grid("11110", "11010", "11000", "00000")) == 1
assert num_islands(grid("11000", "11000", "00100", "00011")) == 3
assert num_islands(grid("0")) == 0
assert num_islands(grid("1")) == 1
# diagonal cells are not connected
assert num_islands(grid("101", "010", "101")) == 5
# a U shape is one island, even though a row scan splits it
assert num_islands(grid("101", "101", "111")) == 1
