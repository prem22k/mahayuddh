class DSU:
    def __init__(self, n: int) -> None:
        # each node starts as the root of its own group
        self.parent = list(range(n))
        self.size = [1] * n

    def find(self, x: int) -> int:
        # path compression: point x straight at its root
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    # False if a and b were already in one group
    def unite(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        # union by size: the smaller group goes under
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        return True
# ---- code ----
def min_cost_connect_points(points: list[list[int]]) -> int:
    n = len(points)
    edges: list[tuple[int, int, int]] = []
    for i in range(n):
        for j in range(i + 1, n):
            d = (abs(points[i][0] - points[j][0])
                 + abs(points[i][1] - points[j][1]))
            edges.append((d, i, j))
    # cheapest edges first
    edges.sort()
    dsu = DSU(n)
    total, used = 0, 0
    for d, i, j in edges:
        # an edge inside one group would make a cycle
        if dsu.unite(i, j):
            total += d
            used += 1
            # a tree on n points has n - 1 edges
            if used == n - 1:
                break
    return total
# ---- checks ----
P = [[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]
assert min_cost_connect_points(P) == 20
assert min_cost_connect_points([[3, 12], [-2, 5], [-4, 1]]) == 18
assert min_cost_connect_points([[0, 0]]) == 0
assert min_cost_connect_points([[0, 0], [1, 1], [1, 0], [-1, 1]]) == 4
# many equal edges: any choice gives the same total
assert min_cost_connect_points([[0, 0], [0, 1], [1, 0], [1, 1]]) == 3
