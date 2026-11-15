def decode_string(s: str) -> str:
    # one entry each per open "[": the text before it,
    # and how many times its inside repeats
    strs: list[str] = []
    counts: list[int] = []
    cur, num = "", 0
    for ch in s:
        if ch.isdigit():
            num = num * 10 + int(ch)
        elif ch == "[":
            # save where we are, start a fresh string
            strs.append(cur)
            counts.append(num)
            cur, num = "", 0
        elif ch == "]":
            # saved text, then the inside repeated
            cur = strs.pop() + cur * counts.pop()
        else:
            cur += ch
    return cur
# ---- checks ----
assert decode_string("3[a]2[bc]") == "aaabcbc"
assert decode_string("3[a2[c]]") == "accaccacc"
assert decode_string("2[abc]3[cd]ef") == "abcabccdcdcdef"
assert decode_string("") == ""
assert decode_string("abc") == "abc"
# counts can have more than one digit
assert decode_string("10[a]") == "aaaaaaaaaa"
assert decode_string("x2[y3[z]]w") == "xyzzzyzzzw"
