#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int findMin(const vector<int>& nums) {
    // values <= the last one form the right, rotated part;
    // the minimum is the first of them
    int last = nums.back();
    int lo = 0, hi = (int)nums.size() - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] <= last) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return nums[lo];
}
// ---- checks ----
int main() {
    assert(findMin({3, 4, 5, 1, 2}) == 1);
    assert(findMin({4, 5, 6, 7, 0, 1, 2}) == 0);
    assert(findMin({11, 13, 15, 17}) == 11);
    assert(findMin({1}) == 1);
    assert(findMin({2, 1}) == 1);
    assert(findMin({2, 3, 4, 5, 1}) == 1);
    return 0;
}
