def remove_duplicates(nums: list[int]) -> int:
    # nums[0..write-1] holds the values kept so far
    write = 0
    for read in range(len(nums)):
        # sorted, so a new value differs from the last kept
        if write == 0 or nums[read] != nums[write - 1]:
            nums[write] = nums[read]
            write += 1
    return write
# ---- checks ----
a = [1, 1, 2]
assert remove_duplicates(a) == 2 and a[:2] == [1, 2]
a = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]
assert remove_duplicates(a) == 5 and a[:5] == [0, 1, 2, 3, 4]
assert remove_duplicates([]) == 0
a = [7]
assert remove_duplicates(a) == 1 and a == [7]
a = [-3, -3, -3]
assert remove_duplicates(a) == 1 and a[0] == -3
a = [1, 2, 3]
assert remove_duplicates(a) == 3 and a == [1, 2, 3]
