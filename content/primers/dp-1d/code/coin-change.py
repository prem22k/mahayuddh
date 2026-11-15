# ---- code ----
def coin_change(coins: list[int], amount: int) -> int:
    # state: dp[a] = fewest coins that make exactly a.
    # amount + 1 coins is impossible, so it means "can't"
    big = amount + 1
    dp = [big] * (amount + 1)
    # base case: 0 needs no coins
    dp[0] = 0
    # order: small amounts first; dp[a] reads dp[a - c]
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                # coin c last, on top of the best for a - c
                dp[a] = min(dp[a], dp[a - c] + 1)
    return -1 if dp[amount] == big else dp[amount]
# ---- checks ----
assert coin_change([1, 2, 5], 11) == 3
assert coin_change([2], 3) == -1
assert coin_change([1], 0) == 0
assert coin_change([5], 5) == 1
# greedy takes 4 + 1 + 1; the best is 3 + 3
assert coin_change([1, 3, 4], 6) == 2
assert coin_change([186, 419, 83, 408], 6249) == 20
# some amounts on the way can't be made, the target can
assert coin_change([3, 7], 10) == 2
