# ---- code ----
def single_number(nums: list[int]) -> int:
    # x ^ x = 0 and x ^ 0 = x, in any order, so every pair
    # cancels and only the unpaired number is left
    acc = 0
    for x in nums:
        acc ^= x
    return acc
# ---- checks ----
assert single_number([4, 1, 2, 1, 2]) == 4
assert single_number([2, 2, 1]) == 1
assert single_number([1]) == 1
# negatives cancel the same way
assert single_number([-3, 7, 7]) == -3
assert single_number([5, -3, 5]) == -3
# the answer can be 0
assert single_number([0, 5, 5]) == 0
# pairs don't have to be next to each other
assert single_number([9, 1, 9, 3, 1, 8, 3]) == 8
