# ---- code ----
def min_distance(word1: str, word2: str) -> int:
    m, n = len(word1), len(word2)
    # state: dp[i][j] = edits from word1[:i] to word2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    # base cases: i letters to none is i deletes,
    # none to j letters is j inserts
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if word1[i - 1] == word2[j - 1]:
                # same last letter: it needs no edit
                dp[i][j] = dp[i - 1][j - 1]
            else:
                # one edit, then the cheapest of: delete
                # (up), insert (left), replace (up-left)
                dp[i][j] = 1 + min(
                    dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]
                )
    return dp[m][n]
# ---- checks ----
assert min_distance("horse", "ros") == 3
assert min_distance("intention", "execution") == 5
assert min_distance("", "abc") == 3
assert min_distance("abc", "") == 3
assert min_distance("", "") == 0
assert min_distance("same", "same") == 0
# a swap is two edits: two replaces, or delete and insert
assert min_distance("ab", "ba") == 2
# one insert in the middle
assert min_distance("ac", "abc") == 1
