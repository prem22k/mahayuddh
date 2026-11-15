def is_valid(s: str) -> bool:
    # each closer and the opener it needs
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    for ch in s:
        if ch not in pairs:
            # an opener: wait for its closer
            stack.append(ch)
        elif not stack or stack[-1] != pairs[ch]:
            # nothing open, or the wrong kind is open
            return False
        else:
            # closes the most recent open bracket
            stack.pop()
    # anything still open was never closed
    return not stack
# ---- checks ----
assert is_valid("([]{})")
assert is_valid("()")
assert is_valid("{[]}")
assert is_valid("")
assert not is_valid("(]")
assert not is_valid("([)]")
assert not is_valid("(")
assert not is_valid("]")
# balanced counts, wrong order
assert not is_valid(")(")
