import java.util.*;
// ---- code ----
class Solution {
    public int coinChange(int[] coins, int amount) {
        // state: dp[a] = fewest coins that make exactly a.
        // amount + 1 coins is impossible, so it means "can't"
        int big = amount + 1;
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, big);
        // base case: 0 needs no coins
        dp[0] = 0;
        // order: small amounts first; dp[a] reads dp[a - c]
        for (int a = 1; a <= amount; a++) {
            for (int c : coins) {
                if (c <= a) {
                    // coin c last, on top of the best for a - c
                    dp[a] = Math.min(dp[a], dp[a - c] + 1);
                }
            }
        }
        return dp[amount] == big ? -1 : dp[amount];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.coinChange(new int[]{1, 2, 5}, 11) == 3, "example 1");
        check(s.coinChange(new int[]{2}, 3) == -1, "impossible");
        check(s.coinChange(new int[]{1}, 0) == 0, "zero");
        check(s.coinChange(new int[]{5}, 5) == 1, "one coin");
        // greedy takes 4 + 1 + 1; the best is 3 + 3
        check(s.coinChange(new int[]{1, 3, 4}, 6) == 2, "greedy fails");
        check(s.coinChange(new int[]{186, 419, 83, 408}, 6249) == 20, "large");
        // some amounts on the way can't be made, the target can
        check(s.coinChange(new int[]{3, 7}, 10) == 2, "gaps");
    }
}
