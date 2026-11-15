#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<int> nextGreaterElements(const vector<int>& nums) {
    int n = nums.size();
    vector<int> ans(n, -1);
    // indices still waiting for a greater value
    vector<int> stack;
    // go round twice so the end can see the start
    for (int i = 0; i < 2 * n; ++i) {
        int x = nums[i % n];
        while (!stack.empty() && nums[stack.back()] < x) {
            ans[stack.back()] = x;
            stack.pop_back();
        }
        // push each index once, on the first lap only
        if (i < n) stack.push_back(i);
    }
    return ans;
}
// ---- checks ----
int main() {
    assert((nextGreaterElements({1, 2, 1}) == vector<int>{2, -1, 2}));
    assert((nextGreaterElements({1, 2, 3, 4, 3}) == vector<int>{2, 3, 4, -1, 4}));
    assert(nextGreaterElements({}).empty());
    assert((nextGreaterElements({5}) == vector<int>{-1}));
    assert((nextGreaterElements({3, 3, 3}) == vector<int>{-1, -1, -1}));
    assert((nextGreaterElements({5, 4, 3, 2, 1}) == vector<int>{-1, 5, 5, 5, 5}));
    return 0;
}
