#include <algorithm>
#include <cassert>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
int minDistance(const string& word1, const string& word2) {
    int m = word1.size(), n = word2.size();
    // state: dp[i][j] = edits from word1[:i] to word2[:j]
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));
    // base cases: i letters to none is i deletes,
    // none to j letters is j inserts
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (word1[i - 1] == word2[j - 1]) {
                // same last letter: it needs no edit
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                // one edit, then the cheapest of: delete
                // (up), insert (left), replace (up-left)
                dp[i][j] = 1 + min({dp[i - 1][j], dp[i][j - 1],
                                    dp[i - 1][j - 1]});
            }
        }
    }
    return dp[m][n];
}
// ---- checks ----
int main() {
    assert(minDistance("horse", "ros") == 3);
    assert(minDistance("intention", "execution") == 5);
    assert(minDistance("", "abc") == 3);
    assert(minDistance("abc", "") == 3);
    assert(minDistance("", "") == 0);
    assert(minDistance("same", "same") == 0);
    // a swap is two edits: two replaces, or delete and insert
    assert(minDistance("ab", "ba") == 2);
    // one insert in the middle
    assert(minDistance("ac", "abc") == 1);
    return 0;
}
