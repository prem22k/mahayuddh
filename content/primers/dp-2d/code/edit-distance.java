// ---- code ----
class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        // state: dp[i][j] = edits from word1[:i] to word2[:j]
        int[][] dp = new int[m + 1][n + 1];
        // base cases: i letters to none is i deletes,
        // none to j letters is j inserts
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                char a = word1.charAt(i - 1);
                char b = word2.charAt(j - 1);
                if (a == b) {
                    // same last letter: it needs no edit
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    // one edit, then the cheapest of: delete
                    // (up), insert (left), replace (up-left)
                    dp[i][j] = 1 + Math.min(
                        Math.min(dp[i - 1][j], dp[i][j - 1]),
                        dp[i - 1][j - 1]);
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
        check(s.minDistance("horse", "ros") == 3, "example 1");
        check(s.minDistance("intention", "execution") == 5, "example 2");
        check(s.minDistance("", "abc") == 3, "all inserts");
        check(s.minDistance("abc", "") == 3, "all deletes");
        check(s.minDistance("", "") == 0, "both empty");
        check(s.minDistance("same", "same") == 0, "equal");
        // a swap is two edits: two replaces, or delete and insert
        check(s.minDistance("ab", "ba") == 2, "swap");
        // one insert in the middle
        check(s.minDistance("ac", "abc") == 1, "middle insert");
    }
}
