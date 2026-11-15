import java.util.*;
// ---- code ----
class Solution {
    public int[] buildPrefix(int[] nums) {
        // pre[i] = sum of the first i numbers; pre[0] = 0
        int[] pre = new int[nums.length + 1];
        for (int i = 0; i < nums.length; i++) {
            pre[i + 1] = pre[i] + nums[i];
        }
        return pre;
    }

    public int rangeSum(int[] pre, int left, int right) {
        // sum of nums[left..right], both ends included
        return pre[right + 1] - pre[left];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        int[] pre = s.buildPrefix(new int[]{-2, 0, 3, -5, 2, -1});
        check(Arrays.equals(pre, new int[]{0, -2, -2, 1, -4, -2, -3}), "prefix array");
        check(s.rangeSum(pre, 0, 2) == 1, "0..2");
        check(s.rangeSum(pre, 2, 5) == -1, "2..5");
        check(s.rangeSum(pre, 0, 5) == -3, "whole array");
        check(s.rangeSum(pre, 3, 3) == -5, "one element");
        check(s.rangeSum(s.buildPrefix(new int[]{7}), 0, 0) == 7, "single");
        check(Arrays.equals(s.buildPrefix(new int[]{}), new int[]{0}), "empty");
    }
}
