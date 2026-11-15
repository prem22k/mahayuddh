import java.util.*;
// ---- code ----
class Solution {
    public int lengthOfLIS(int[] nums) {
        int n = nums.length;
        // state: dp[i] = longest increasing run ending at i
        // base case: nums[i] alone is a run of length 1
        int[] dp = new int[n];
        Arrays.fill(dp, 1);
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < i; j++) {
                // nums[i] can extend any run that ends lower
                if (nums[j] < nums[i]) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }
        }
        // the run can end anywhere, so take the best of all i
        return Arrays.stream(dp).max().getAsInt();
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.lengthOfLIS(new int[]{10, 9, 2, 5, 3, 7, 101, 18}) == 4, "example 1");
        check(s.lengthOfLIS(new int[]{0, 1, 0, 3, 2, 3}) == 4, "example 2");
        check(s.lengthOfLIS(new int[]{7, 7, 7, 7}) == 1, "all equal");
        check(s.lengthOfLIS(new int[]{5}) == 1, "one");
        // strictly increasing: the repeated 3 counts once
        check(s.lengthOfLIS(new int[]{1, 3, 3, 4}) == 3, "strict");
        // the best run doesn't end at the last element
        check(s.lengthOfLIS(new int[]{1, 2, 3, 0}) == 3, "ends early");
        check(s.lengthOfLIS(new int[]{4, 10, 4, 3, 8, 9}) == 3, "mixed");
    }
}
