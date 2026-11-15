def find_max_length(nums: list[int]) -> int:
    # count 0 as -1, so a balanced stretch sums to 0.
    # prefix -> the FIRST index where it appeared
    first = {0: -1}
    prefix = best = 0
    for i, x in enumerate(nums):
        prefix += 1 if x == 1 else -1
        if prefix in first:
            # same prefix twice: the part between sums to 0
            best = max(best, i - first[prefix])
        else:
            # keep the first index: it gives the longest
            first[prefix] = i
    return best
# ---- checks ----
assert find_max_length([0, 1]) == 2
assert find_max_length([0, 1, 0]) == 2
assert find_max_length([0, 0, 1, 0, 0, 0, 1, 1]) == 6
assert find_max_length([]) == 0
assert find_max_length([1]) == 0
assert find_max_length([1, 1, 1, 0]) == 2
# overwriting the first index would give 2 here
assert find_max_length([0, 1, 1, 0, 1, 0]) == 6
