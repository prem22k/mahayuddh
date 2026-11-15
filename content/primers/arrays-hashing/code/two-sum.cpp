#include <cassert>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
vector<int> twoSum(const vector<int>& nums, int target) {
    // value -> index, for everything left of i
    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); ++i) {
        // 1. is the partner already stored?
        int need = target - nums[i];
        auto it = seen.find(need);
        if (it != seen.end()) return {it->second, i};
        // 2. no: store this value for later numbers
        seen[nums[i]] = i;
    }
    return {};
}
// ---- checks ----
int main() {
    assert((twoSum({4, 6, 1, 9, 3, 5}, 8) == vector<int>{4, 5}));
    assert((twoSum({2, 7, 11, 15}, 9) == vector<int>{0, 1}));
    assert((twoSum({3, 3}, 6) == vector<int>{0, 1}));
    assert((twoSum({3, 2, 4}, 6) == vector<int>{1, 2}));
    assert((twoSum({-1, -2, -3, -4, -5}, -8) == vector<int>{2, 4}));
    assert(twoSum({5}, 10).empty());
    assert(twoSum({}, 1).empty());
    return 0;
}
