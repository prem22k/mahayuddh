def max_area(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        h = min(height[left], height[right])
        best = max(best, h * (right - left))
        # the shorter wall can't do better with any closer
        # partner, so it's done: move it inward
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return best
# ---- checks ----
assert max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]) == 49
assert max_area([1, 1]) == 1
assert max_area([4, 3, 2, 1, 4]) == 16
assert max_area([1, 2, 1]) == 2
assert max_area([5]) == 0
assert max_area([]) == 0
# the best pair can be two tall walls side by side
assert max_area([1, 2, 4, 3]) == 4
assert max_area([2, 3, 4, 5, 18, 17, 6]) == 17
