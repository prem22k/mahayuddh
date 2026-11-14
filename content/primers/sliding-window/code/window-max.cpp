#include <cassert>
#include <deque>
#include <vector>
using namespace std;
// ---- code ----
vector<int> maxSlidingWindow(const vector<int>& nums, int k) {
    // indices; values decrease from front to back
    deque<int> dq;
    vector<int> out;
    for (int i = 0; i < (int)nums.size(); ++i) {
        // smaller values can never be a max again
        while (!dq.empty() && nums[dq.back()] <= nums[i]) {
            dq.pop_back();
        }
        dq.push_back(i);
        // the front slid out of the window
        if (dq.front() <= i - k) dq.pop_front();
        // the front is this window's max
        if (i >= k - 1) out.push_back(nums[dq.front()]);
    }
    return out;
}
// ---- checks ----
int main() {
    assert((maxSlidingWindow({1, 3, -1, -3, 5, 3, 6, 7}, 3) == vector<int>{3, 3, 5, 5, 6, 7}));
    assert((maxSlidingWindow({1}, 1) == vector<int>{1}));
    assert((maxSlidingWindow({9, 8, 7, 6}, 2) == vector<int>{9, 8, 7}));
    assert((maxSlidingWindow({4, 4, 4}, 2) == vector<int>{4, 4}));
    return 0;
}
