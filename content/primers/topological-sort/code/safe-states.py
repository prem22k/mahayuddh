from collections import deque
# ---- code ----
def eventual_safe_nodes(graph: list[list[int]]) -> list[int]:
    n = len(graph)
    # flip every edge: parents[v] lists who points at v
    parents: list[list[int]] = [[] for _ in range(n)]
    outdegree = [0] * n
    for u in range(n):
        outdegree[u] = len(graph[u])
        for v in graph[u]:
            parents[v].append(u)
    # nodes with no way out are safe; peel back from them
    queue = deque(u for u in range(n) if outdegree[u] == 0)
    safe = [False] * n
    while queue:
        v = queue.popleft()
        safe[v] = True
        for u in parents[v]:
            outdegree[u] -= 1
            # every edge out of u now leads to a safe node
            if outdegree[u] == 0:
                queue.append(u)
    return [u for u in range(n) if safe[u]]
# ---- checks ----
assert eventual_safe_nodes(
    [[1, 2], [2, 3], [5], [0], [5], [], []]) == [2, 4, 5, 6]
assert eventual_safe_nodes(
    [[1, 2, 3, 4], [1, 2], [3, 4], [0, 4], []]) == [4]
assert eventual_safe_nodes([[]]) == [0]
# a node that points at itself is never safe
assert eventual_safe_nodes([[0], []]) == [1]
# one edge into a cycle is enough to be unsafe
assert eventual_safe_nodes([[1, 3], [2], [1], []]) == [3]
# a chain with no cycle: all safe
assert eventual_safe_nodes([[1], [2], [3], []]) == [0, 1, 2, 3]
