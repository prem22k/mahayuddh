#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int largestRectangleArea(const vector<int>& heights) {
    int n = heights.size();
    // bar indices; heights rise from bottom to top
    vector<int> stack;
    int best = 0;
    // one extra bar of height 0 at i = n empties the stack
    for (int i = 0; i <= n; ++i) {
        int h = i < n ? heights[i] : 0;
        while (!stack.empty() && heights[stack.back()] >= h) {
            // the popped bar can't stretch right past i-1,
            // nor left past the bar now on top
            int top = heights[stack.back()];
            stack.pop_back();
            int left = stack.empty() ? -1 : stack.back();
            best = max(best, top * (i - left - 1));
        }
        stack.push_back(i);
    }
    return best;
}
// ---- checks ----
int main() {
    assert(largestRectangleArea({2, 1, 5, 6, 2, 3}) == 10);
    assert(largestRectangleArea({2, 4}) == 4);
    assert(largestRectangleArea({}) == 0);
    assert(largestRectangleArea({7}) == 7);
    assert(largestRectangleArea({2, 2, 2}) == 6);
    assert(largestRectangleArea({6, 2, 5, 4, 5, 1, 6}) == 12);
    assert(largestRectangleArea({1, 2, 3, 4, 5}) == 9);
    return 0;
}
