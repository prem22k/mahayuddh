def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    out: list[list[int]] = []
    n = len(nums)
    for i in range(n - 2):
        # same first value again would repeat triplets
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        # two-sum on the rest, looking for -a
        a = nums[i]
        lo, hi = i + 1, n - 1
        while lo < hi:
            s = a + nums[lo] + nums[hi]
            if s < 0:
                lo += 1
                continue
            if s > 0:
                hi -= 1
                continue
            out.append([a, nums[lo], nums[hi]])
            lo += 1
            hi -= 1
            # skip copies of the value just used
            while lo < hi and nums[lo] == nums[lo - 1]:
                lo += 1
    return out
# ---- checks ----
assert three_sum([-1, 0, 1, 2, -1, -4]) == [[-1, -1, 2], [-1, 0, 1]]
assert three_sum([0, 1, 1]) == []
assert three_sum([0, 0, 0]) == [[0, 0, 0]]
assert three_sum([]) == []
assert three_sum([1]) == []
# duplicates must not repeat a triplet
assert three_sum([0, 0, 0, 0]) == [[0, 0, 0]]
assert three_sum([-2, 0, 0, 2, 2]) == [[-2, 0, 2]]
assert three_sum([-2, -2, 0, 0, 2, 2]) == [[-2, 0, 2]]
