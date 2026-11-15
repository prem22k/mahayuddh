#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int countMaxOrSubsets(const vector<int>& nums) {
    int n = nums.size();
    // OR only adds bits, so the OR of everything is the max
    int best = 0;
    for (int x : nums) best |= x;
    int count = 0;
    // each mask from 1 to 2^n - 1 is one non-empty subset:
    // bit i set means nums[i] is in it
    for (int mask = 1; mask < (1 << n); mask++) {
        int acc = 0;
        for (int i = 0; i < n; i++) {
            if ((mask >> i) & 1) acc |= nums[i];
        }
        if (acc == best) count++;
    }
    return count;
}
// ---- checks ----
int main() {
    assert(countMaxOrSubsets({3, 1}) == 2);
    assert(countMaxOrSubsets({2, 2, 2}) == 7);
    assert(countMaxOrSubsets({3, 2, 1, 5}) == 6);
    assert(countMaxOrSubsets({5}) == 1);
    // every bit is in one number only: all of them are needed
    assert(countMaxOrSubsets({1, 2, 4}) == 1);
    // the max OR is 0: every non-empty subset counts, not the empty one
    assert(countMaxOrSubsets({0, 0}) == 3);
    // 16 numbers: 2^16 - 1 non-empty subsets, all with OR 1
    assert(countMaxOrSubsets(vector<int>(16, 1)) == 65535);
    return 0;
}
