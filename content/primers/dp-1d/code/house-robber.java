// ---- code ----
class Solution {
    public int rob(int[] nums) {
        int n = nums.length;
        // state: dp[i] = the most from the first i houses
        int[] dp = new int[n + 1];
        // base cases: no houses gives 0, one house gives itself
        if (n > 0) dp[1] = nums[0];
        // order: left to right, as dp[i] reads i - 1 and i - 2
        for (int i = 2; i <= n; i++) {
            // skip house i, or rob it and add dp[i - 2]
            dp[i] = Math.max(dp[i - 1],
                             dp[i - 2] + nums[i - 1]);
        }
        return dp[n];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.rob(new int[]{2, 7, 9, 3, 1}) == 12, "walkthrough");
        check(s.rob(new int[]{1, 2, 3, 1}) == 4, "example 1");
        check(s.rob(new int[]{5}) == 5, "one house");
        check(s.rob(new int[]{}) == 0, "no houses");
        check(s.rob(new int[]{0, 0}) == 0, "zeros");
        // the best skips two houses in a row: 2 + 2, not 2 + 1
        check(s.rob(new int[]{2, 1, 1, 2}) == 4, "skip two");
        // taking every other house from the start isn't always best
        check(s.rob(new int[]{1, 9, 1, 1, 9}) == 18, "not alternating");
    }
}
