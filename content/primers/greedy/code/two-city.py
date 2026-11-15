# ---- code ----
def two_city_sched_cost(costs: list[list[int]]) -> int:
    # most money saved by flying to A, relative to B, first
    costs.sort(key=lambda c: c[0] - c[1])
    n = len(costs) // 2
    total = 0
    for i, (a, b) in enumerate(costs):
        # first half flies to A, second half to B
        total += a if i < n else b
    return total
# ---- checks ----
assert two_city_sched_cost([[10, 20], [30, 200], [400, 50], [30, 20]]) == 110
assert two_city_sched_cost(
    [[259, 770], [448, 54], [926, 667], [184, 139], [840, 118], [577, 469]]
) == 1859
assert two_city_sched_cost([[5, 9], [2, 1]]) == 6
# A is cheaper for everyone, but only half may go
assert two_city_sched_cost([[1, 100], [2, 50], [3, 10], [4, 5]]) == 1 + 2 + 10 + 5
