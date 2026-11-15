def is_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    # letter -> (times in s) - (times in t)
    count: dict[str, int] = {}
    for a, b in zip(s, t):
        count[a] = count.get(a, 0) + 1
        count[b] = count.get(b, 0) - 1
    # an anagram leaves every count at zero
    return all(c == 0 for c in count.values())
# ---- checks ----
assert is_anagram("anagram", "nagaram")
assert not is_anagram("rat", "car")
assert is_anagram("", "")
assert is_anagram("a", "a")
assert not is_anagram("a", "ab")
# same letters, different counts
assert not is_anagram("aacc", "ccac")
