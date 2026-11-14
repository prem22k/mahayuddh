def find_max_average(nums: list[int], k: int) -> float:
    # the first window, built once
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        # one in, one out
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best / k
# ---- checks ----
assert abs(find_max_average([1, 12, -5, -6, 50, 3], 4) - 12.75) < 1e-9
assert find_max_average([5], 1) == 5
assert find_max_average([-1, -2, -3], 2) == -1.5
