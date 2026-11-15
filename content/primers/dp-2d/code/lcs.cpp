#include <algorithm>
#include <cassert>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
int longestCommonSubsequence(const string& text1,
                             const string& text2) {
    int m = text1.size(), n = text2.size();
    // state: dp[i][j] = LCS of text1[:i] and text2[:j]
    // base cases: row 0 and column 0 stay 0 (an empty side)
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));
    // order: row by row, left to right. A cell reads the one
    // above, the one to its left and the one up-left
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (text1[i - 1] == text2[j - 1]) {
                // the last letters match: use them both
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                // drop the last letter of one side
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[m][n];
}
// ---- checks ----
int main() {
    assert(longestCommonSubsequence("abcde", "ace") == 3);
    assert(longestCommonSubsequence("abc", "abc") == 3);
    assert(longestCommonSubsequence("abc", "def") == 0);
    assert(longestCommonSubsequence("", "abc") == 0);
    assert(longestCommonSubsequence("a", "a") == 1);
    // a subsequence, not a substring: gaps are allowed
    assert(longestCommonSubsequence("ezupkr", "ubmrapg") == 2);
    // order matters: "ab" and "ba" share only one letter in order
    assert(longestCommonSubsequence("ab", "ba") == 1);
    assert(longestCommonSubsequence("bsbininm", "jmjkbkjkv") == 1);
    return 0;
}
