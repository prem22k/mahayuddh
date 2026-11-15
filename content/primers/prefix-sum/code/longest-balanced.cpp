#include <algorithm>
#include <cassert>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
int findMaxLength(const vector<int>& nums) {
    // count 0 as -1, so a balanced stretch sums to 0.
    // prefix -> the FIRST index where it appeared
    unordered_map<int, int> first{{0, -1}};
    int prefix = 0, best = 0;
    for (int i = 0; i < (int)nums.size(); ++i) {
        prefix += nums[i] == 1 ? 1 : -1;
        auto it = first.find(prefix);
        if (it != first.end()) {
            // same prefix twice: the part between sums to 0
            best = max(best, i - it->second);
        } else {
            // keep the first index: it gives the longest
            first[prefix] = i;
        }
    }
    return best;
}
// ---- checks ----
int main() {
    assert(findMaxLength({0, 1}) == 2);
    assert(findMaxLength({0, 1, 0}) == 2);
    assert(findMaxLength({0, 0, 1, 0, 0, 0, 1, 1}) == 6);
    assert(findMaxLength({}) == 0);
    assert(findMaxLength({1}) == 0);
    assert(findMaxLength({1, 1, 1, 0}) == 2);
    assert(findMaxLength({0, 1, 1, 0, 1, 0}) == 6);
    return 0;
}
