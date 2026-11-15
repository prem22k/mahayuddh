# ---- code ----
def can_complete_circuit(
    gas: list[int], cost: list[int]
) -> int:
    total = tank = start = 0
    for i in range(len(gas)):
        total += gas[i] - cost[i]
        tank += gas[i] - cost[i]
        # stuck before i + 1: no start from start..i works
        if tank < 0:
            start = i + 1
            tank = 0
    # enough gas overall means the last start survives
    return start if total >= 0 else -1
# ---- checks ----
assert can_complete_circuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]) == 3
assert can_complete_circuit([2, 3, 4], [3, 4, 3]) == -1
assert can_complete_circuit([5], [4]) == 0
assert can_complete_circuit([4], [5]) == -1
# exactly enough gas in total
assert can_complete_circuit([1, 1, 3], [2, 2, 1]) == 2
# a tank of exactly zero is not stuck: keep the start
assert can_complete_circuit([2, 3, 1], [2, 1, 3]) == 0
assert can_complete_circuit([3, 1, 1], [1, 2, 2]) == 0
