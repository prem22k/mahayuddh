#include <cassert>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
int subarraySum(const vector<int>& nums, int k) {
    // prefix sum -> how many times it has appeared;
    // 0 is the empty prefix, before index 0
    unordered_map<int, int> seen{{0, 1}};
    int prefix = 0, count = 0;
    for (int x : nums) {
        prefix += x;
        // 1. earlier prefixes == prefix - k: one match each
        auto it = seen.find(prefix - k);
        if (it != seen.end()) count += it->second;
        // 2. then record this prefix for later indices
        ++seen[prefix];
    }
    return count;
}
// ---- checks ----
int main() {
    assert(subarraySum({1, 2, 3, -3, 3}, 3) == 5);
    assert(subarraySum({1, 1, 1}, 2) == 2);
    assert(subarraySum({1, 2, 3}, 3) == 2);
    assert(subarraySum({}, 0) == 0);
    assert(subarraySum({5}, 5) == 1);
    assert(subarraySum({5}, 4) == 0);
    assert(subarraySum({0, 0, 0}, 0) == 6);
    assert(subarraySum({1, -1, 0}, 0) == 3);
    return 0;
}
