import java.util.*;
// ---- code ----
class Solution {
    public int countMaxOrSubsets(int[] nums) {
        int n = nums.length;
        // OR only adds bits, so the OR of everything is the max
        int best = 0;
        for (int x : nums) best |= x;
        int count = 0;
        // each mask from 1 to 2^n - 1 is one non-empty subset:
        // bit i set means nums[i] is in it
        for (int mask = 1; mask < (1 << n); mask++) {
            int acc = 0;
            for (int i = 0; i < n; i++) {
                if (((mask >> i) & 1) == 1) acc |= nums[i];
            }
            if (acc == best) count++;
        }
        return count;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.countMaxOrSubsets(new int[]{3, 1}) == 2, "example 1");
        check(s.countMaxOrSubsets(new int[]{2, 2, 2}) == 7, "example 2");
        check(s.countMaxOrSubsets(new int[]{3, 2, 1, 5}) == 6, "example 3");
        check(s.countMaxOrSubsets(new int[]{5}) == 1, "one");
        // every bit is in one number only: all of them are needed
        check(s.countMaxOrSubsets(new int[]{1, 2, 4}) == 1, "all needed");
        // the max OR is 0: every non-empty subset counts, not the empty one
        check(s.countMaxOrSubsets(new int[]{0, 0}) == 3, "zeros");
        // 16 numbers: 2^16 - 1 non-empty subsets, all with OR 1
        int[] ones = new int[16];
        Arrays.fill(ones, 1);
        check(s.countMaxOrSubsets(ones) == 65535, "sixteen");
    }
}
