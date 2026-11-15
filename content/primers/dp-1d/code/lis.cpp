#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int lengthOfLIS(const vector<int>& nums) {
    int n = nums.size();
    // state: dp[i] = longest increasing run ending at i
    // base case: nums[i] alone is a run of length 1
    vector<int> dp(n, 1);
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < i; j++) {
            // nums[i] can extend any run that ends lower
            if (nums[j] < nums[i]) {
                dp[i] = max(dp[i], dp[j] + 1);
            }
        }
    }
    // the run can end anywhere, so take the best of all i
    return *max_element(dp.begin(), dp.end());
}
// ---- checks ----
int main() {
    assert(lengthOfLIS({10, 9, 2, 5, 3, 7, 101, 18}) == 4);
    assert(lengthOfLIS({0, 1, 0, 3, 2, 3}) == 4);
    assert(lengthOfLIS({7, 7, 7, 7}) == 1);
    assert(lengthOfLIS({5}) == 1);
    // strictly increasing: the repeated 3 counts once
    assert(lengthOfLIS({1, 3, 3, 4}) == 3);
    // the best run doesn't end at the last element
    assert(lengthOfLIS({1, 2, 3, 0}) == 3);
    assert(lengthOfLIS({4, 10, 4, 3, 8, 9}) == 3);
    return 0;
}
