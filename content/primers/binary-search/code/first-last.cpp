#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int firstAtLeast(const vector<int>& nums, int x) {
    // first index with nums[i] >= x, or len(nums) if none
    int lo = 0, hi = nums.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] >= x) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}

vector<int> searchRange(const vector<int>& nums, int target) {
    int start = firstAtLeast(nums, target);
    if (start == (int)nums.size() || nums[start] != target) {
        return {-1, -1};
    }
    // the last target is just before the first bigger value
    int end = firstAtLeast(nums, target + 1) - 1;
    return {start, end};
}
// ---- checks ----
int main() {
    assert((searchRange({5, 7, 7, 8, 8, 10}, 8) == vector<int>{3, 4}));
    assert((searchRange({5, 7, 7, 8, 8, 10}, 6) == vector<int>{-1, -1}));
    assert((searchRange({}, 0) == vector<int>{-1, -1}));
    assert((searchRange({1}, 1) == vector<int>{0, 0}));
    assert((searchRange({2, 2, 2, 2}, 2) == vector<int>{0, 3}));
    assert((searchRange({1, 3}, 2) == vector<int>{-1, -1}));
    assert((searchRange({1, 3}, 4) == vector<int>{-1, -1}));
    return 0;
}
