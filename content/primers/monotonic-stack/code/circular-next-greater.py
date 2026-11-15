def next_greater_elements(nums: list[int]) -> list[int]:
    n = len(nums)
    ans = [-1] * n
    # indices still waiting for a greater value
    stack: list[int] = []
    # go round twice so the end can see the start
    for i in range(2 * n):
        x = nums[i % n]
        while stack and nums[stack[-1]] < x:
            ans[stack.pop()] = x
        # push each index once, on the first lap only
        if i < n:
            stack.append(i)
    return ans
# ---- checks ----
assert next_greater_elements([1, 2, 1]) == [2, -1, 2]
assert next_greater_elements([1, 2, 3, 4, 3]) == [2, 3, 4, -1, 4]
assert next_greater_elements([]) == []
assert next_greater_elements([5]) == [-1]
assert next_greater_elements([3, 3, 3]) == [-1, -1, -1]
# the answer for most of these is found on the second lap
assert next_greater_elements([5, 4, 3, 2, 1]) == [-1, 5, 5, 5, 5]
