def largest_rectangle_area(heights: list[int]) -> int:
    n = len(heights)
    # bar indices; heights rise from bottom to top
    stack: list[int] = []
    best = 0
    # one extra bar of height 0 at i = n empties the stack
    for i in range(n + 1):
        h = heights[i] if i < n else 0
        while stack and heights[stack[-1]] >= h:
            # the popped bar can't stretch right past i-1,
            # nor left past the bar now on top
            top = heights[stack.pop()]
            left = stack[-1] if stack else -1
            best = max(best, top * (i - left - 1))
        stack.append(i)
    return best
# ---- checks ----
assert largest_rectangle_area([2, 1, 5, 6, 2, 3]) == 10
assert largest_rectangle_area([2, 4]) == 4
assert largest_rectangle_area([]) == 0
assert largest_rectangle_area([7]) == 7
# equal heights must still span the whole run
assert largest_rectangle_area([2, 2, 2]) == 6
assert largest_rectangle_area([6, 2, 5, 4, 5, 1, 6]) == 12
assert largest_rectangle_area([1, 2, 3, 4, 5]) == 9
