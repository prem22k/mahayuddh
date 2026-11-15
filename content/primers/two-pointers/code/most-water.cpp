#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int maxArea(const vector<int>& height) {
    int left = 0, right = (int)height.size() - 1;
    int best = 0;
    while (left < right) {
        int h = min(height[left], height[right]);
        best = max(best, h * (right - left));
        // the shorter wall can't do better with any closer
        // partner, so it's done: move it inward
        if (height[left] < height[right]) {
            ++left;
        } else {
            --right;
        }
    }
    return best;
}
// ---- checks ----
int main() {
    assert(maxArea({1, 8, 6, 2, 5, 4, 8, 3, 7}) == 49);
    assert(maxArea({1, 1}) == 1);
    assert(maxArea({4, 3, 2, 1, 4}) == 16);
    assert(maxArea({1, 2, 1}) == 2);
    assert(maxArea({5}) == 0);
    assert(maxArea({}) == 0);
    assert(maxArea({1, 2, 4, 3}) == 4);
    assert(maxArea({2, 3, 4, 5, 18, 17, 6}) == 17);
    return 0;
}
