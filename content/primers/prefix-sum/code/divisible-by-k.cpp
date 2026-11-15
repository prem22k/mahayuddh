#include <cassert>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
int subarraysDivByK(const vector<int>& nums, int k) {
    // prefix remainder -> how many times it has appeared.
    // equal remainders differ by a multiple of k
    unordered_map<int, int> seen{{0, 1}};
    int rem = 0, count = 0;
    for (int x : nums) {
        // keep the remainder in 0..k-1, even for negatives
        rem = ((rem + x) % k + k) % k;
        count += seen[rem];
        ++seen[rem];
    }
    return count;
}
// ---- checks ----
int main() {
    assert(subarraysDivByK({4, 5, 0, -2, -3, 1}, 5) == 7);
    assert(subarraysDivByK({5}, 9) == 0);
    assert(subarraysDivByK({5}, 5) == 1);
    assert(subarraysDivByK({}, 3) == 0);
    assert(subarraysDivByK({-1, 2, 9}, 2) == 2);
    assert(subarraysDivByK({-1, -1, 2}, 2) == 3);
    return 0;
}
