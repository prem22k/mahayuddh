#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int robLine(const vector<int>& nums, int lo, int hi) {
    // houses lo .. hi - 1 in a row. dp[i] only reads
    // dp[i - 1] and dp[i - 2], so keep just those two
    int prev2 = 0, prev1 = 0;
    for (int i = lo; i < hi; i++) {
        int cur = max(prev1, prev2 + nums[i]);
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}

int rob(const vector<int>& nums) {
    int n = nums.size();
    // one house has no neighbour, so take it
    if (n == 1) return nums[0];
    // first and last are neighbours: leave one of them out
    return max(robLine(nums, 0, n - 1), robLine(nums, 1, n));
}
// ---- checks ----
int main() {
    assert(rob({2, 3, 2}) == 3);
    assert(rob({1, 2, 3, 1}) == 4);
    assert(rob({1, 2, 3}) == 3);
    assert(rob({5}) == 5);
    assert(rob({4, 9}) == 9);
    // the answer drops the first house
    assert(rob({1, 3, 1, 3, 100}) == 103);
    // the answer drops the last house
    assert(rob({200, 3, 140, 20, 10}) == 340);
    return 0;
}
