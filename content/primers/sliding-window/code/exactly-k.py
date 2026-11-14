def subarrays_with_k_distinct(nums: list[int], k: int) -> int:
    def at_most(k: int) -> int:
        count, left, total = {}, 0, 0
        for right, x in enumerate(nums):
            count[x] = count.get(x, 0) + 1
            # too many distinct: shrink
            while len(count) > k:
                count[nums[left]] -= 1
                if count[nums[left]] == 0:
                    del count[nums[left]]
                left += 1
            # every window that ends at right
            total += right - left + 1
        return total

    # exactly k = at most k − at most k−1
    return at_most(k) - at_most(k - 1)
# ---- checks ----
assert subarrays_with_k_distinct([1, 2, 1, 2, 3], 2) == 7
assert subarrays_with_k_distinct([1, 2, 1, 3, 4], 3) == 3
assert subarrays_with_k_distinct([1], 1) == 1
