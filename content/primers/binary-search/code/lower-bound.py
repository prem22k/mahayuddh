def search_insert(nums: list[int], target: int) -> int:
    # the answer is in lo..hi; hi itself means "at the end"
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] >= target:
            # mid works; the first one is mid or left of it
            hi = mid
        else:
            # mid and everything left of it are too small
            lo = mid + 1
    # lo == hi: the first index with nums[i] >= target
    return lo
# ---- checks ----
assert search_insert([1, 3, 4, 6, 8, 9, 11, 13, 15, 18], 12) == 7
assert search_insert([1, 3, 5, 6], 5) == 2
assert search_insert([1, 3, 5, 6], 2) == 1
assert search_insert([1, 3, 5, 6], 7) == 4
assert search_insert([1, 3, 5, 6], 0) == 0
assert search_insert([], 3) == 0
assert search_insert([4], 4) == 0
assert search_insert([4], 5) == 1
# duplicates: the FIRST position, not any match
assert search_insert([2, 2, 2, 3], 2) == 0
