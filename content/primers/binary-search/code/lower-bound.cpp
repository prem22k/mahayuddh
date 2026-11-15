#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int searchInsert(const vector<int>& nums, int target) {
    // the answer is in lo..hi; hi itself means "at the end"
    int lo = 0, hi = nums.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] >= target) {
            // mid works; the first one is mid or left of it
            hi = mid;
        } else {
            // mid and everything left of it are too small
            lo = mid + 1;
        }
    }
    // lo == hi: the first index with nums[i] >= target
    return lo;
}
// ---- checks ----
int main() {
    assert(searchInsert({1, 3, 4, 6, 8, 9, 11, 13, 15, 18}, 12) == 7);
    assert(searchInsert({1, 3, 5, 6}, 5) == 2);
    assert(searchInsert({1, 3, 5, 6}, 2) == 1);
    assert(searchInsert({1, 3, 5, 6}, 7) == 4);
    assert(searchInsert({1, 3, 5, 6}, 0) == 0);
    assert(searchInsert({}, 3) == 0);
    assert(searchInsert({4}, 4) == 0);
    assert(searchInsert({4}, 5) == 1);
    assert(searchInsert({2, 2, 2, 3}, 2) == 0);
    return 0;
}
