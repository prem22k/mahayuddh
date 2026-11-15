import heapq
# ---- code ----
def k_closest(
    points: list[list[int]], k: int
) -> list[list[int]]:
    # max-heap of (distance, index): the k closest so far
    heap = []
    for i, (x, y) in enumerate(points):
        d = x * x + y * y
        heapq.heappush(heap, (-d, i))
        # one too many: drop the farthest
        if len(heap) > k:
            heapq.heappop(heap)
    return [points[i] for _, i in heap]
# ---- checks ----
assert k_closest([[1, 3], [-2, 2]], 1) == [[-2, 2]]
assert sorted(k_closest([[3, 3], [5, -1], [-2, 4]], 2)) == [
    [-2, 4], [3, 3]]
assert k_closest([[0, 0]], 1) == [[0, 0]]
# k = n returns everything
assert sorted(k_closest([[1, 0], [0, 2], [3, 0]], 3)) == [
    [0, 2], [1, 0], [3, 0]]
# the far point comes first and must be dropped later
assert sorted(k_closest([[10, 10], [1, 1], [0, 1]], 2)) == [
    [0, 1], [1, 1]]
