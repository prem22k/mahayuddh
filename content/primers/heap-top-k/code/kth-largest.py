import heapq
# ---- code ----
def find_kth_largest(nums: list[int], k: int) -> int:
    # min-heap of the k largest values seen so far
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        # one too many: the smallest can't be in the top k
        if len(heap) > k:
            heapq.heappop(heap)
    # the smallest of the k largest is the kth largest
    return heap[0]
# ---- checks ----
assert find_kth_largest([3, 2, 1, 5, 6, 4], 2) == 5
assert find_kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
assert find_kth_largest([7], 1) == 7
# k = n is the minimum; k = 1 is the maximum
assert find_kth_largest([4, -1, 9, 0], 4) == -1
assert find_kth_largest([4, -1, 9, 0], 1) == 9
# duplicates count separately
assert find_kth_largest([5, 5, 5, 1], 3) == 5
