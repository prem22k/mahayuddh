# ---- code ----
def valid_path(n: int, edges: list[list[int]],
               source: int, destination: int) -> bool:
    # adjacency list: graph[u] holds u's neighbours
    graph: list[list[int]] = [[] for _ in range(n)]
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)
    seen = [False] * n
    seen[source] = True
    # a stack makes this DFS; a queue would make it BFS
    stack = [source]
    while stack:
        u = stack.pop()
        if u == destination:
            return True
        for v in graph[u]:
            if not seen[v]:
                seen[v] = True
                stack.append(v)
    return False
# ---- checks ----
assert valid_path(3, [[0, 1], [1, 2], [2, 0]], 0, 2)
assert not valid_path(6, [[0, 1], [0, 2], [3, 5], [5, 4], [4, 3]], 0, 5)
assert valid_path(1, [], 0, 0)
# edges go both ways
assert valid_path(2, [[1, 0]], 0, 1)
# a cycle must not loop forever
assert not valid_path(4, [[0, 1], [1, 2], [2, 0]], 0, 3)
# a long chain
assert valid_path(1000, [[i, i + 1] for i in range(999)], 0, 999)
