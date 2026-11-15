def two_sum(numbers: list[int], target: int) -> list[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        s = numbers[left] + numbers[right]
        if s == target:
            # the problem wants 1-based indices
            return [left + 1, right + 1]
        if s < target:
            # too small even with the largest partner,
            # so numbers[left] fits no answer: drop it
            left += 1
        else:
            # too big even with the smallest partner,
            # so numbers[right] fits no answer: drop it
            right -= 1
    return []
# ---- checks ----
assert two_sum([1, 3, 4, 6, 8, 11], 10) == [3, 4]
assert two_sum([2, 7, 11, 15], 9) == [1, 2]
assert two_sum([2, 3, 4], 6) == [1, 3]
assert two_sum([-1, 0], -1) == [1, 2]
assert two_sum([5], 10) == []
assert two_sum([], 0) == []
# equal values: the two 4s, not one 4 twice
assert two_sum([1, 2, 3, 4, 4, 9, 56, 90], 8) == [4, 5]
