import heapq
# ---- code ----
def network_delay_time(
    times: list[list[int]], n: int, k: int
) -> int:
    graph: list[list[tuple[int, int]]] = [
        [] for _ in range(n + 1)
    ]
    for u, v, w in times:
        graph[u].append((v, w))
    inf = float("inf")
    dist = [inf] * (n + 1)
    dist[k] = 0
    # (distance so far, node); the smallest pops first
    heap = [(0, k)]
    while heap:
        d, u = heapq.heappop(heap)
        # a stale entry: u was already reached more cheaply
        if d > dist[u]:
            continue
        # d is final for u; try every edge out of it
        for v, w in graph[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(heap, (dist[v], v))
    best = 0
    for i in range(1, n + 1):
        # a node never reached: the signal can't get there
        if dist[i] == inf:
            return -1
        best = max(best, dist[i])
    return best
# ---- checks ----
walk = [[1, 2, 4], [1, 3, 1], [3, 2, 2], [2, 4, 1], [3, 4, 5]]
assert network_delay_time(walk, 4, 1) == 4
assert network_delay_time([[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2) == 2
assert network_delay_time([[1, 2, 1]], 2, 1) == 1
# edges are directed: 2 can't reach 1
assert network_delay_time([[1, 2, 1]], 2, 2) == -1
assert network_delay_time([], 1, 1) == 0
# a cycle, and a direct edge that is not the shortest way
cyc = [[1, 2, 1], [2, 1, 1], [2, 3, 5], [1, 3, 10]]
assert network_delay_time(cyc, 3, 1) == 6
# one node cut off among reachable ones
assert network_delay_time([[1, 2, 3], [2, 3, 3]], 4, 1) == -1
