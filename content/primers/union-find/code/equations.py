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
def equations_possible(equations: list[str]) -> bool:
    dsu = DSU(26)
    # pass 1: join every pair that must be equal
    for e in equations:
        if e[1] == "=":
            x = ord(e[0]) - ord("a")
            y = ord(e[3]) - ord("a")
            dsu.unite(x, y)
    # pass 2: no "!=" may sit inside one group
    for e in equations:
        if e[1] == "!":
            x = ord(e[0]) - ord("a")
            y = ord(e[3]) - ord("a")
            if dsu.find(x) == dsu.find(y):
                return False
    return True
# ---- checks ----
assert not equations_possible(["a==b", "b!=a"])
assert equations_possible(["b==a", "a==b"])
assert not equations_possible(["a!=a"])
assert equations_possible(["a==a"])
# the "!=" comes first, so one pass would miss it
assert not equations_possible(["a!=b", "b==c", "c==a"])
# equality chains through c
assert not equations_possible(["a==c", "c==b", "a!=b"])
assert equations_possible(["a==b", "c==d", "a!=d"])
