# ---- code ----
def length_of_lis(nums: list[int]) -> int:
    n = len(nums)
    # state: dp[i] = longest increasing run ending at i
    # base case: nums[i] alone is a run of length 1
    dp = [1] * n
    for i in range(n):
        for j in range(i):
            # nums[i] can extend any run that ends lower
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    # the run can end anywhere, so take the best of all i
    return max(dp)
# ---- checks ----
assert length_of_lis([10, 9, 2, 5, 3, 7, 101, 18]) == 4
assert length_of_lis([0, 1, 0, 3, 2, 3]) == 4
assert length_of_lis([7, 7, 7, 7]) == 1
assert length_of_lis([5]) == 1
# strictly increasing: the repeated 3 counts once
assert length_of_lis([1, 3, 3, 4]) == 3
# the best run doesn't end at the last element
assert length_of_lis([1, 2, 3, 0]) == 3
assert length_of_lis([4, 10, 4, 3, 8, 9]) == 3
