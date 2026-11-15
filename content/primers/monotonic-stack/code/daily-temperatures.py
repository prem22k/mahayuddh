def daily_temperatures(temps: list[int]) -> list[int]:
    ans = [0] * len(temps)
    # days still waiting for a warmer one; their temps
    # never rise from the bottom of the stack to the top
    stack: list[int] = []
    for i, t in enumerate(temps):
        # today answers every colder day on top
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            ans[j] = i - j
        stack.append(i)
    # days left on the stack never warm up: they stay 0
    return ans
# ---- checks ----
assert daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]) == [1, 1, 4, 2, 1, 1, 0, 0]
assert daily_temperatures([30, 40, 50, 60]) == [1, 1, 1, 0]
assert daily_temperatures([30, 60, 90]) == [1, 1, 0]
assert daily_temperatures([]) == []
assert daily_temperatures([50]) == [0]
# equal is not warmer
assert daily_temperatures([70, 70, 71]) == [2, 1, 0]
assert daily_temperatures([90, 80, 70]) == [0, 0, 0]
