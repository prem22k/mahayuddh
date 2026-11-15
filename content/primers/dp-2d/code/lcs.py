# ---- code ----
def longest_common_subsequence(text1: str, text2: str) -> int:
    m, n = len(text1), len(text2)
    # state: dp[i][j] = LCS of text1[:i] and text2[:j]
    # base cases: row 0 and column 0 stay 0 (an empty side)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    # order: row by row, left to right. A cell reads the one
    # above, the one to its left and the one up-left
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i - 1] == text2[j - 1]:
                # the last letters match: use them both
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                # drop the last letter of one side
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]
# ---- checks ----
assert longest_common_subsequence("abcde", "ace") == 3
assert longest_common_subsequence("abc", "abc") == 3
assert longest_common_subsequence("abc", "def") == 0
assert longest_common_subsequence("", "abc") == 0
assert longest_common_subsequence("a", "a") == 1
# a subsequence, not a substring: gaps are allowed
assert longest_common_subsequence("ezupkr", "ubmrapg") == 2
# order matters: "ab" and "ba" share only one letter in order
assert longest_common_subsequence("ab", "ba") == 1
assert longest_common_subsequence("bsbininm", "jmjkbkjkv") == 1
