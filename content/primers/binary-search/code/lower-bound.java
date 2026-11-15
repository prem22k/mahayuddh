import java.util.*;
// ---- code ----
class Solution {
    public int searchInsert(int[] nums, int target) {
        // the answer is in lo..hi; hi itself means "at the end"
        int lo = 0, hi = nums.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] >= target) {
                // mid works; the first one is mid or left of it
                hi = mid;
            } else {
                // mid and everything left of it are too small
                lo = mid + 1;
            }
        }
        // lo == hi: the first index with nums[i] >= target
        return lo;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.searchInsert(new int[]{1, 3, 4, 6, 8, 9, 11, 13, 15, 18}, 12) == 7, "walkthrough");
        check(s.searchInsert(new int[]{1, 3, 5, 6}, 5) == 2, "found");
        check(s.searchInsert(new int[]{1, 3, 5, 6}, 2) == 1, "between");
        check(s.searchInsert(new int[]{1, 3, 5, 6}, 7) == 4, "after all");
        check(s.searchInsert(new int[]{1, 3, 5, 6}, 0) == 0, "before all");
        check(s.searchInsert(new int[]{}, 3) == 0, "empty");
        check(s.searchInsert(new int[]{4}, 4) == 0, "single found");
        check(s.searchInsert(new int[]{4}, 5) == 1, "single after");
        check(s.searchInsert(new int[]{2, 2, 2, 3}, 2) == 0, "first of duplicates");
    }
}
