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
def make_connected(n: int, connections: list[list[int]]) -> int:
    # joining n computers needs at least n - 1 cables
    if len(connections) < n - 1:
        return -1
    dsu = DSU(n)
    groups = n
    for a, b in connections:
        # each real merge turns two groups into one
        if dsu.unite(a, b):
            groups -= 1
    # one moved cable joins two groups
    return groups - 1
# ---- checks ----
assert make_connected(4, [[0, 1], [0, 2], [1, 2]]) == 1
assert make_connected(6, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]]) == 2
assert make_connected(6, [[0, 1], [0, 2], [0, 3], [1, 2]]) == -1
# already connected
assert make_connected(3, [[0, 1], [1, 2]]) == 0
assert make_connected(1, []) == 0
# enough cables, but all inside one group: move them
assert make_connected(5, [[0, 1], [1, 2], [2, 0], [0, 3]]) == 1
