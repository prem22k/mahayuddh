# ---- code ----
def find_cheapest_price(
    n: int, flights: list[list[int]], src: int, dst: int, k: int
) -> int:
    inf = float("inf")
    cost = [inf] * n
    cost[src] = 0
    # after r rounds: the cheapest using at most r flights
    for _ in range(k + 1):
        # copy first, so a round adds at most one flight
        prev = cost[:]
        for u, v, w in flights:
            if prev[u] != inf and prev[u] + w < cost[v]:
                cost[v] = prev[u] + w
    return -1 if cost[dst] == inf else cost[dst]
# ---- checks ----
f1 = [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]]
assert find_cheapest_price(4, f1, 0, 3, 1) == 700
f2 = [[0, 1, 100], [1, 2, 100], [0, 2, 500]]
assert find_cheapest_price(3, f2, 0, 2, 1) == 200
assert find_cheapest_price(3, f2, 0, 2, 0) == 500
assert find_cheapest_price(3, [[0, 1, 5]], 0, 2, 2) == -1
# without the copy, 0 -> 1 -> 2 sneaks in with k = 0
f3 = [[0, 1, 1], [1, 2, 1], [0, 2, 5]]
assert find_cheapest_price(3, f3, 0, 2, 0) == 5
assert find_cheapest_price(3, f3, 0, 2, 1) == 2
# more stops allowed than needed is fine
assert find_cheapest_price(3, f3, 0, 2, 5) == 2
