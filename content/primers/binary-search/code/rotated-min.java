import java.util.*;
// ---- code ----
class Solution {
    public int findMin(int[] nums) {
        // values <= the last one form the right, rotated part;
        // the minimum is the first of them
        int last = nums[nums.length - 1];
        int lo = 0, hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] <= last) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        return nums[lo];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.findMin(new int[]{3, 4, 5, 1, 2}) == 1, "example 1");
        check(s.findMin(new int[]{4, 5, 6, 7, 0, 1, 2}) == 0, "example 2");
        check(s.findMin(new int[]{11, 13, 15, 17}) == 11, "not rotated");
        check(s.findMin(new int[]{1}) == 1, "single");
        check(s.findMin(new int[]{2, 1}) == 1, "two");
        check(s.findMin(new int[]{2, 3, 4, 5, 1}) == 1, "min at the end");
    }
}
