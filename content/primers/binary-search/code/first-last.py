def first_at_least(nums: list[int], x: int) -> int:
    # first index with nums[i] >= x, or len(nums) if none
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] >= x:
            hi = mid
        else:
            lo = mid + 1
    return lo

def search_range(nums: list[int], target: int) -> list[int]:
    start = first_at_least(nums, target)
    if start == len(nums) or nums[start] != target:
        return [-1, -1]
    # the last target is just before the first bigger value
    end = first_at_least(nums, target + 1) - 1
    return [start, end]
# ---- checks ----
assert search_range([5, 7, 7, 8, 8, 10], 8) == [3, 4]
assert search_range([5, 7, 7, 8, 8, 10], 6) == [-1, -1]
assert search_range([], 0) == [-1, -1]
assert search_range([1], 1) == [0, 0]
assert search_range([2, 2, 2, 2], 2) == [0, 3]
assert search_range([1, 3], 2) == [-1, -1]
# target bigger than everything: start == len(nums)
assert search_range([1, 3], 4) == [-1, -1]
