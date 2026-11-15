def remove_kdigits(num: str, k: int) -> str:
    # digits kept so far; they never fall bottom to top
    stack: list[str] = []
    for d in num:
        # a bigger digit just before a smaller one: drop it
        while k > 0 and stack and stack[-1] > d:
            stack.pop()
            k -= 1
        stack.append(d)
    # any removals still owed come off the (largest) end
    stack = stack[: len(stack) - k]
    # strip leading zeros; nothing left means "0"
    out = "".join(stack).lstrip("0")
    return out if out else "0"
# ---- checks ----
assert remove_kdigits("1432219", 3) == "1219"
assert remove_kdigits("10200", 1) == "200"
assert remove_kdigits("10", 2) == "0"
assert remove_kdigits("9", 1) == "0"
assert remove_kdigits("12345", 0) == "12345"
# already rising: the cuts come off the end
assert remove_kdigits("12345", 2) == "123"
assert remove_kdigits("112", 1) == "11"
assert remove_kdigits("100", 1) == "0"
