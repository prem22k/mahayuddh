# ---- code ----
def hamming_weight(n: int) -> int:
    # Python ints have no width: keep the low 32 bits,
    # which is the same pattern C++ and Java see
    n &= 0xFFFFFFFF
    count = 0
    while n:
        # n - 1 flips the lowest 1 and the 0s below it,
        # so n & (n - 1) clears exactly that lowest 1
        n &= n - 1
        count += 1
    return count
# ---- checks ----
assert hamming_weight(11) == 3
assert hamming_weight(128) == 1
assert hamming_weight(2147483645) == 30
assert hamming_weight(0) == 0
# -1 is 32 ones in two's complement
assert hamming_weight(-1) == 32
# the sign bit alone
assert hamming_weight(-2147483648) == 1
# a power of two has one bit, so n & (n - 1) == 0
assert hamming_weight(1 << 20) == 1
