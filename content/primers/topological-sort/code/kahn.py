from collections import deque
# ---- code ----
def find_order(num_courses: int,
               prerequisites: list[list[int]]) -> list[int]:
    graph: list[list[int]] = [[] for _ in range(num_courses)]
    indegree = [0] * num_courses
    # [a, b] means take b before a: an edge b -> a
    for a, b in prerequisites:
        graph[b].append(a)
        indegree[a] += 1
    # start with every course that needs nothing
    queue = deque(i for i in range(num_courses)
                  if indegree[i] == 0)
    order: list[int] = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph[u]:
            # u is done, so v waits on one course fewer
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
    # a cycle keeps its courses above 0 forever
    if len(order) < num_courses:
        return []
    return order
# ---- checks ----
def valid(n: int, pre: list[list[int]], order: list[int]) -> bool:
    pos = {c: i for i, c in enumerate(order)}
    return (sorted(order) == list(range(n))
            and all(pos[b] < pos[a] for a, b in pre))


# the walkthrough
W = [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3], [4, 5]]
assert find_order(6, W) == [0, 5, 1, 2, 3, 4]
assert find_order(2, [[1, 0]]) == [0, 1]
P = [[1, 0], [2, 0], [3, 1], [3, 2]]
assert valid(4, P, find_order(4, P))
assert find_order(1, []) == [0]
assert find_order(2, [[1, 0], [0, 1]]) == []
# 0 is free, but 1 -> 2 -> 3 -> 1 is a cycle
assert find_order(4, [[1, 0], [2, 1], [3, 2], [1, 3]]) == []
# a course that requires itself
assert find_order(1, [[0, 0]]) == []
# no prerequisites at all: every order works
assert valid(3, [], find_order(3, []))
