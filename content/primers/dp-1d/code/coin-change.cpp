#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int coinChange(const vector<int>& coins, int amount) {
    // state: dp[a] = fewest coins that make exactly a.
    // amount + 1 coins is impossible, so it means "can't"
    int big = amount + 1;
    vector<int> dp(amount + 1, big);
    // base case: 0 needs no coins
    dp[0] = 0;
    // order: small amounts first; dp[a] reads dp[a - c]
    for (int a = 1; a <= amount; a++) {
        for (int c : coins) {
            if (c <= a) {
                // coin c last, on top of the best for a - c
                dp[a] = min(dp[a], dp[a - c] + 1);
            }
        }
    }
    return dp[amount] == big ? -1 : dp[amount];
}
// ---- checks ----
int main() {
    assert(coinChange({1, 2, 5}, 11) == 3);
    assert(coinChange({2}, 3) == -1);
    assert(coinChange({1}, 0) == 0);
    assert(coinChange({5}, 5) == 1);
    // greedy takes 4 + 1 + 1; the best is 3 + 3
    assert(coinChange({1, 3, 4}, 6) == 2);
    assert(coinChange({186, 419, 83, 408}, 6249) == 20);
    // some amounts on the way can't be made, the target can
    assert(coinChange({3, 7}, 10) == 2);
    return 0;
}
