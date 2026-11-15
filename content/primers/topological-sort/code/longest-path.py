from collections import deque
# ---- code ----
def minimum_time(n: int, relations: list[list[int]],
                 time: list[int]) -> int:
    graph: list[list[int]] = [[] for _ in range(n)]
    indegree = [0] * n
    # courses are 1..n; [a, b] means a before b
    for a, b in relations:
        graph[a - 1].append(b - 1)
        indegree[b - 1] += 1
    # start[v]: the earliest month v can begin
    start = [0] * n
    queue = deque(i for i in range(n) if indegree[i] == 0)
    best = 0
    while queue:
        u = queue.popleft()
        finish = start[u] + time[u]
        best = max(best, finish)
        for v in graph[u]:
            # v waits for its slowest prerequisite
            start[v] = max(start[v], finish)
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
    return best
# ---- checks ----
assert minimum_time(3, [[1, 3], [2, 3]], [3, 2, 5]) == 8
assert minimum_time(
    5, [[1, 5], [2, 5], [3, 5], [3, 4], [4, 5]], [1, 2, 3, 4, 5]) == 12
assert minimum_time(1, [], [7]) == 7
# no relations: everything runs at once, the longest wins
assert minimum_time(3, [], [1, 5, 2]) == 5
# the slow branch decides, not the one with more courses
assert minimum_time(4, [[1, 2], [2, 3], [1, 4]], [1, 1, 1, 9]) == 10
