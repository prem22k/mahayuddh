// ---- code ----
class Solution {
    public int longestCommonSubsequence(String text1,
                                        String text2) {
        int m = text1.length(), n = text2.length();
        // state: dp[i][j] = LCS of text1[:i] and text2[:j]
        // base cases: row 0 and column 0 stay 0 (an empty side)
        int[][] dp = new int[m + 1][n + 1];
        // order: row by row, left to right. A cell reads the
        // one above, the one to its left and the one up-left
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                char a = text1.charAt(i - 1);
                char b = text2.charAt(j - 1);
                if (a == b) {
                    // the last letters match: use them both
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    // drop the last letter of one side
                    dp[i][j] = Math.max(dp[i - 1][j],
                                        dp[i][j - 1]);
                }
            }
        }
        return dp[m][n];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.longestCommonSubsequence("abcde", "ace") == 3, "walkthrough");
        check(s.longestCommonSubsequence("abc", "abc") == 3, "same");
        check(s.longestCommonSubsequence("abc", "def") == 0, "nothing shared");
        check(s.longestCommonSubsequence("", "abc") == 0, "empty");
        check(s.longestCommonSubsequence("a", "a") == 1, "one letter");
        // a subsequence, not a substring: gaps are allowed
        check(s.longestCommonSubsequence("ezupkr", "ubmrapg") == 2, "gaps");
        // order matters: "ab" and "ba" share only one letter in order
        check(s.longestCommonSubsequence("ab", "ba") == 1, "order");
        check(s.longestCommonSubsequence("bsbininm", "jmjkbkjkv") == 1, "one shared");
    }
}
