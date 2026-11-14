from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    # indices; values decrease from front to back
    dq = deque()
    out = []
    for i, x in enumerate(nums):
        # smaller values can never be a max again
        while dq and nums[dq[-1]] <= x:
            dq.pop()
        dq.append(i)
        # the front slid out of the window
        if dq[0] <= i - k:
            dq.popleft()
        # the front is this window's max
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out
# ---- checks ----
assert max_sliding_window([1, 3, -1, -3, 5, 3, 6, 7], 3) == [3, 3, 5, 5, 6, 7]
assert max_sliding_window([1], 1) == [1]
assert max_sliding_window([9, 8, 7, 6], 2) == [9, 8, 7]
assert max_sliding_window([4, 4, 4], 2) == [4, 4]
