def subarray_sum(nums: list[int], k: int) -> int:
    # prefix sum -> how many times it has appeared;
    # 0 is the empty prefix, before index 0
    seen = {0: 1}
    prefix = count = 0
    for x in nums:
        prefix += x
        # 1. earlier prefixes == prefix - k: one match each
        count += seen.get(prefix - k, 0)
        # 2. then record this prefix for later indices
        seen[prefix] = seen.get(prefix, 0) + 1
    return count
# ---- checks ----
assert subarray_sum([1, 2, 3, -3, 3], 3) == 5
assert subarray_sum([1, 1, 1], 2) == 2
assert subarray_sum([1, 2, 3], 3) == 2
assert subarray_sum([], 0) == 0
assert subarray_sum([5], 5) == 1
assert subarray_sum([5], 4) == 0
# k = 0: look up before recording, or each prefix matches itself
assert subarray_sum([0, 0, 0], 0) == 6
assert subarray_sum([1, -1, 0], 0) == 3
