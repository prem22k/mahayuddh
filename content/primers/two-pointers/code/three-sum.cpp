#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<int>> threeSum(vector<int> nums) {
    sort(nums.begin(), nums.end());
    vector<vector<int>> out;
    int n = nums.size();
    for (int i = 0; i + 2 < n; ++i) {
        // same first value again would repeat triplets
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        // two-sum on the rest, looking for -a
        int a = nums[i];
        int lo = i + 1, hi = n - 1;
        while (lo < hi) {
            int s = a + nums[lo] + nums[hi];
            if (s < 0) { ++lo; continue; }
            if (s > 0) { --hi; continue; }
            out.push_back({a, nums[lo], nums[hi]});
            ++lo;
            --hi;
            // skip copies of the value just used
            while (lo < hi && nums[lo] == nums[lo - 1]) {
                ++lo;
            }
        }
    }
    return out;
}
// ---- checks ----
int main() {
    using V = vector<vector<int>>;
    assert((threeSum({-1, 0, 1, 2, -1, -4}) == V{{-1, -1, 2}, {-1, 0, 1}}));
    assert(threeSum({0, 1, 1}).empty());
    assert((threeSum({0, 0, 0}) == V{{0, 0, 0}}));
    assert(threeSum({}).empty());
    assert(threeSum({1}).empty());
    assert((threeSum({0, 0, 0, 0}) == V{{0, 0, 0}}));
    assert((threeSum({-2, 0, 0, 2, 2}) == V{{-2, 0, 2}}));
    assert((threeSum({-2, -2, 0, 0, 2, 2}) == V{{-2, 0, 2}}));
    return 0;
}
