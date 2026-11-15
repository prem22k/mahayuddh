#include <cassert>
#include <numeric>
#include <vector>
using namespace std;
// ---- code ----
bool canPartition(const vector<int>& nums) {
    int total = accumulate(nums.begin(), nums.end(), 0);
    // an odd total can't split into two equal halves
    if (total % 2 == 1) return false;
    int target = total / 2;
    // state: dp[i][s] = some of the first i items sum to s.
    // Row i only reads row i - 1, so keep a single row
    vector<bool> can(target + 1, false);
    // base case: the empty choice sums to 0
    can[0] = true;
    for (int x : nums) {
        // right to left: can[s - x] is still last row's value,
        // so x is used at most once
        for (int s = target; s >= x; s--) {
            if (can[s - x]) can[s] = true;
        }
    }
    return can[target];
}
// ---- checks ----
int main() {
    assert(canPartition({1, 5, 11, 5}));
    assert(!canPartition({1, 2, 3, 5}));
    assert(canPartition({1, 1}));
    assert(!canPartition({100}));
    assert(canPartition({2, 2, 1, 1}));
    // odd total
    assert(!canPartition({1, 2}));
    // left to right would reuse 1 to make 4 = 1 + 1 + 2
    assert(!canPartition({1, 2, 5}));
    // a number bigger than the target is just skipped
    assert(canPartition({3, 3, 3, 3, 12}));
    return 0;
}
