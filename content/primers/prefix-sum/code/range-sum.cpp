#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<int> buildPrefix(const vector<int>& nums) {
    // pre[i] = sum of the first i numbers; pre[0] = 0
    vector<int> pre(nums.size() + 1, 0);
    for (size_t i = 0; i < nums.size(); ++i) {
        pre[i + 1] = pre[i] + nums[i];
    }
    return pre;
}

int rangeSum(const vector<int>& pre, int left, int right) {
    // sum of nums[left..right], both ends included
    return pre[right + 1] - pre[left];
}
// ---- checks ----
int main() {
    vector<int> pre = buildPrefix({-2, 0, 3, -5, 2, -1});
    assert((pre == vector<int>{0, -2, -2, 1, -4, -2, -3}));
    assert(rangeSum(pre, 0, 2) == 1);
    assert(rangeSum(pre, 2, 5) == -1);
    assert(rangeSum(pre, 0, 5) == -3);
    assert(rangeSum(pre, 3, 3) == -5);
    assert(rangeSum(buildPrefix({7}), 0, 0) == 7);
    assert((buildPrefix({}) == vector<int>{0}));
    return 0;
}
