// ---- code ----
class Solution {
    public int rob(int[] nums) {
        int n = nums.length;
        // one house has no neighbour, so take it
        if (n == 1) return nums[0];
        // first and last are neighbours: leave one of them out
        return Math.max(robLine(nums, 0, n - 1),
                        robLine(nums, 1, n));
    }

    private int robLine(int[] nums, int lo, int hi) {
        // houses lo .. hi - 1 in a row. dp[i] only reads
        // dp[i - 1] and dp[i - 2], so keep just those two
        int prev2 = 0, prev1 = 0;
        for (int i = lo; i < hi; i++) {
            int cur = Math.max(prev1, prev2 + nums[i]);
            prev2 = prev1;
            prev1 = cur;
        }
        return prev1;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.rob(new int[]{2, 3, 2}) == 3, "example 1");
        check(s.rob(new int[]{1, 2, 3, 1}) == 4, "example 2");
        check(s.rob(new int[]{1, 2, 3}) == 3, "example 3");
        check(s.rob(new int[]{5}) == 5, "one house");
        check(s.rob(new int[]{4, 9}) == 9, "two houses");
        // the answer drops the first house
        check(s.rob(new int[]{1, 3, 1, 3, 100}) == 103, "drop first");
        // the answer drops the last house
        check(s.rob(new int[]{200, 3, 140, 20, 10}) == 340, "drop last");
    }
}
