# ---- code ----
def jump(nums: list[int]) -> int:
    jumps = 0
    # this many jumps reach up to index end
    end = 0
    # one more jump could reach up to farthest
    farthest = 0
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        # at the edge of this jump's reach: take another
        if i == end:
            jumps += 1
            end = farthest
    return jumps
# ---- checks ----
assert jump([2, 3, 1, 1, 4]) == 2
assert jump([2, 3, 0, 1, 4]) == 2
assert jump([0]) == 0
assert jump([1, 1, 1, 1]) == 3
# one big jump covers everything
assert jump([9, 1, 1, 1, 1]) == 1
# jumping as far as possible first is the trap
assert jump([3, 1, 4, 1, 1, 1, 1]) == 2
