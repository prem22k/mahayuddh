import heapq
# ---- code ----
def top_k_frequent(nums: list[int], k: int) -> list[int]:
    # how often each value appears
    count = {}
    for x in nums:
        count[x] = count.get(x, 0) + 1
    # min-heap of (frequency, value), at most k entries
    heap = []
    for x, c in count.items():
        heapq.heappush(heap, (c, x))
        # drop the least frequent of the k + 1
        if len(heap) > k:
            heapq.heappop(heap)
    return [x for c, x in heap]
# ---- checks ----
assert sorted(top_k_frequent([1, 1, 1, 2, 2, 3], 2)) == [1, 2]
assert top_k_frequent([1], 1) == [1]
# every value once except 4: k = 1 must pick 4
assert top_k_frequent([3, 4, 4, 1, 2], 1) == [4]
# k equals the number of distinct values
assert sorted(top_k_frequent([5, -1, 5, -1, 7], 3)) == [-1, 5, 7]
# frequencies run against value order
assert sorted(top_k_frequent([9, 9, 9, 1, 1, 2, 3], 2)) == [1, 9]
