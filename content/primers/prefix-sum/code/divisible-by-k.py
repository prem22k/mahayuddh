def subarrays_div_by_k(nums: list[int], k: int) -> int:
    # prefix remainder -> how many times it has appeared.
    # equal remainders differ by a multiple of k
    seen = {0: 1}
    rem = count = 0
    for x in nums:
        # keep the remainder in 0..k-1, even for negatives
        rem = ((rem + x) % k + k) % k
        count += seen.get(rem, 0)
        seen[rem] = seen.get(rem, 0) + 1
    return count
# ---- checks ----
assert subarrays_div_by_k([4, 5, 0, -2, -3, 1], 5) == 7
assert subarrays_div_by_k([5], 9) == 0
assert subarrays_div_by_k([5], 5) == 1
assert subarrays_div_by_k([], 3) == 0
# -1 and 1 must land in the same remainder class
assert subarrays_div_by_k([-1, 2, 9], 2) == 2
assert subarrays_div_by_k([-1, -1, 2], 2) == 3
