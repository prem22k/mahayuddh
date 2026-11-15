def hours_needed(piles: list[int], k: int) -> int:
    # each pile takes ceil(pile / k) hours
    return sum((p + k - 1) // k for p in piles)

def min_eating_speed(piles: list[int], h: int) -> int:
    # "speed k is fast enough" goes false ... false,
    # true ... true as k grows: find the first true
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if hours_needed(piles, mid) <= h:
            hi = mid
        else:
            lo = mid + 1
    return lo
# ---- checks ----
assert min_eating_speed([3, 6, 7, 11], 8) == 4
assert min_eating_speed([30, 11, 23, 4, 20], 5) == 30
assert min_eating_speed([30, 11, 23, 4, 20], 6) == 23
assert min_eating_speed([5], 10) == 1
assert min_eating_speed([1000000000], 2) == 500000000
# at speed 1 the total passes 2^31: it needs 64 bits
assert hours_needed([1000000000] * 5, 1) == 5000000000
assert min_eating_speed([1000000000] * 5, 1000000000) == 5
