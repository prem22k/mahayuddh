def find_min(nums: list[int]) -> int:
    # values <= the last one form the right, rotated part;
    # the minimum is the first of them
    last = nums[-1]
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] <= last:
            hi = mid
        else:
            lo = mid + 1
    return nums[lo]
# ---- checks ----
assert find_min([3, 4, 5, 1, 2]) == 1
assert find_min([4, 5, 6, 7, 0, 1, 2]) == 0
assert find_min([11, 13, 15, 17]) == 11
assert find_min([1]) == 1
assert find_min([2, 1]) == 1
# rotated by one: the minimum is the very last element
assert find_min([2, 3, 4, 5, 1]) == 1
