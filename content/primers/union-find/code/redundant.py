# ---- code ----
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


def find_redundant_connection(
        edges: list[list[int]]) -> list[int]:
    # nodes are 1..n and there are n edges
    dsu = DSU(len(edges) + 1)
    for a, b in edges:
        # already connected: this edge closes a cycle
        if not dsu.unite(a, b):
            return [a, b]
    return []
# ---- checks ----
# the walkthrough
W = [[1, 2], [3, 4], [2, 4], [5, 6], [4, 6], [1, 5]]
assert find_redundant_connection(W) == [1, 5]
assert find_redundant_connection([[1, 2], [1, 3], [2, 3]]) == [2, 3]
assert find_redundant_connection(
    [[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]) == [1, 4]
# the cycle closes on the very last edge
assert find_redundant_connection([[1, 2], [2, 3], [3, 1]]) == [3, 1]

# the DSU itself: path compression and union by size
d = DSU(6)
assert d.unite(1, 2) and d.unite(3, 4) and d.unite(2, 4)
assert d.find(4) == 1 and d.parent[4] == 1
assert d.size[1] == 4
assert not d.unite(3, 2)
# a group of 1 hangs under the bigger group's root
assert d.unite(5, 3) and d.find(5) == 1
assert d.find(0) == 0
