def length_of_longest_substring(s: str) -> int:
    count = {}  # what's inside the window
    left = best = 0
    for right, ch in enumerate(s):
        # 1. grow: take s[right] in
        count[ch] = count.get(ch, 0) + 1
        # 2. shrink while the window is invalid
        while count[ch] > 1:
            count[s[left]] -= 1
            left += 1
        # 3. valid again: record it
        best = max(best, right - left + 1)
    return best
# ---- checks ----
assert length_of_longest_substring("pwwkew") == 3
assert length_of_longest_substring("abcabcbb") == 3
assert length_of_longest_substring("bbbbb") == 1
assert length_of_longest_substring("") == 0
assert length_of_longest_substring("dvdf") == 3
assert length_of_longest_substring("abba") == 2
