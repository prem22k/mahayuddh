#include <algorithm>
#include <cassert>
#include <cmath>
#include <vector>
using namespace std;
// ---- code ----
double findMaxAverage(const vector<int>& nums, int k) {
    // the first window, built once
    long long window = 0;
    for (int i = 0; i < k; ++i) window += nums[i];
    long long best = window;
    for (int right = k; right < (int)nums.size(); ++right) {
        // one in, one out
        window += nums[right] - nums[right - k];
        best = max(best, window);
    }
    return (double)best / k;
}
// ---- checks ----
int main() {
    assert(fabs(findMaxAverage({1, 12, -5, -6, 50, 3}, 4) - 12.75) < 1e-9);
    assert(findMaxAverage({5}, 1) == 5);
    assert(findMaxAverage({-1, -2, -3}, 2) == -1.5);
    return 0;
}
