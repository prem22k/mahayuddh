import java.util.*;
// ---- code ----
class Solution {
    int firstAtLeast(int[] nums, int x) {
        // first index with nums[i] >= x, or len(nums) if none
        int lo = 0, hi = nums.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] >= x) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        return lo;
    }

    public int[] searchRange(int[] nums, int target) {
        int start = firstAtLeast(nums, target);
        if (start == nums.length || nums[start] != target) {
            return new int[]{-1, -1};
        }
        // the last target is just before the first bigger value
        int end = firstAtLeast(nums, target + 1) - 1;
        return new int[]{start, end};
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.searchRange(new int[]{5, 7, 7, 8, 8, 10}, 8), new int[]{3, 4}), "example");
        check(Arrays.equals(s.searchRange(new int[]{5, 7, 7, 8, 8, 10}, 6), new int[]{-1, -1}), "missing");
        check(Arrays.equals(s.searchRange(new int[]{}, 0), new int[]{-1, -1}), "empty");
        check(Arrays.equals(s.searchRange(new int[]{1}, 1), new int[]{0, 0}), "single");
        check(Arrays.equals(s.searchRange(new int[]{2, 2, 2, 2}, 2), new int[]{0, 3}), "all equal");
        check(Arrays.equals(s.searchRange(new int[]{1, 3}, 2), new int[]{-1, -1}), "between");
        check(Arrays.equals(s.searchRange(new int[]{1, 3}, 4), new int[]{-1, -1}), "past the end");
    }
}
