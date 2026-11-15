# ---- code ----
def can_finish(num_courses: int,
               prerequisites: list[list[int]]) -> bool:
    graph: list[list[int]] = [[] for _ in range(num_courses)]
    for a, b in prerequisites:
        graph[b].append(a)
    # 0 = not visited, 1 = on the current path, 2 = done
    state = [0] * num_courses

    # True if a cycle can be reached from u
    def has_cycle(u: int) -> bool:
        if state[u] == 1:
            # back on the current path: a cycle
            return True
        if state[u] == 2:
            # fully checked before: no cycle through here
            return False
        state[u] = 1
        for v in graph[u]:
            if has_cycle(v):
                return True
        state[u] = 2
        return False

    for u in range(num_courses):
        if has_cycle(u):
            return False
    return True
# ---- checks ----
assert can_finish(2, [[1, 0]])
assert not can_finish(2, [[1, 0], [0, 1]])
assert can_finish(1, [])
# a diamond reaches 3 twice, but that is not a cycle
assert can_finish(4, [[1, 0], [2, 0], [3, 1], [3, 2]])
# a course that requires itself
assert not can_finish(1, [[0, 0]])
# the cycle is away from course 0
assert not can_finish(4, [[1, 0], [2, 1], [3, 2], [1, 3]])
# two separate parts, both fine
assert can_finish(4, [[1, 0], [3, 2]])
