// ---- code ----
class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int x : nums) total += x;
        // an odd total can't split into two equal halves
        if (total % 2 == 1) return false;
        int target = total / 2;
        // state: dp[i][s] = some of the first i items sum to s.
        // Row i only reads row i - 1, so keep a single row
        boolean[] can = new boolean[target + 1];
        // base case: the empty choice sums to 0
        can[0] = true;
        for (int x : nums) {
            // right to left: can[s - x] is still last row's
            // value, so x is used at most once
            for (int s = target; s >= x; s--) {
                if (can[s - x]) can[s] = true;
            }
        }
        return can[target];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.canPartition(new int[]{1, 5, 11, 5}), "example 1");
        check(!s.canPartition(new int[]{1, 2, 3, 5}), "example 2");
        check(s.canPartition(new int[]{1, 1}), "pair");
        check(!s.canPartition(new int[]{100}), "one number");
        check(s.canPartition(new int[]{2, 2, 1, 1}), "two pairs");
        // odd total
        check(!s.canPartition(new int[]{1, 2}), "odd total");
        // left to right would reuse 1 to make 4 = 1 + 1 + 2
        check(!s.canPartition(new int[]{1, 2, 5}), "no reuse");
        // a number bigger than the target is just skipped
        check(s.canPartition(new int[]{3, 3, 3, 3, 12}), "big number");
    }
}
