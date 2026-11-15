def group_anagrams(strs: list[str]) -> list[list[str]]:
    # sorted letters -> every word with those letters
    groups: dict[str, list[str]] = {}
    for w in strs:
        key = "".join(sorted(w))
        groups.setdefault(key, []).append(w)
    return list(groups.values())
# ---- checks ----
def norm(gs: list[list[str]]) -> list[list[str]]:
    return sorted(sorted(g) for g in gs)

got = group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])
assert norm(got) == [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]
assert norm(group_anagrams([""])) == [[""]]
assert norm(group_anagrams(["a"])) == [["a"]]
assert group_anagrams([]) == []
# same letters, different counts: not one group
assert norm(group_anagrams(["ab", "aab", "ba"])) == [["aab"], ["ab", "ba"]]
