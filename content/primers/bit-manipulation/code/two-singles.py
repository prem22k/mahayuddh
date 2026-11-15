# ---- code ----
def single_number_iii(nums: list[int]) -> list[int]:
    # pairs cancel, so both = a ^ b. Since a != b, both has
    # a 1 bit somewhere a and b differ
    both = 0
    for x in nums:
        both ^= x
    # x & -x keeps only the lowest 1 bit of x
    low = both & -both
    a = 0
    for x in nums:
        # split on that bit: a and b go to different sides,
        # and the two copies of a pair go to the same side
        if x & low:
            a ^= x
    return [a, both ^ a]
# ---- checks ----
assert sorted(single_number_iii([1, 2, 1, 3, 2, 5])) == [3, 5]
assert sorted(single_number_iii([-1, 0])) == [-1, 0]
assert sorted(single_number_iii([0, 1])) == [0, 1]
# they differ only in a higher bit: 2 = 010, 6 = 110
assert sorted(single_number_iii([2, 6, 4, 4])) == [2, 6]
# the lowest differing bit is the sign bit
lo, hi = -2147483648, 2147483647
assert sorted(single_number_iii([lo, 0])) == [lo, 0]
assert sorted(single_number_iii([lo, 7, hi, 7])) == [lo, hi]
