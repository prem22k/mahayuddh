#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int singleNumber(const vector<int>& nums) {
    // x ^ x = 0 and x ^ 0 = x, in any order, so every pair
    // cancels and only the unpaired number is left
    int acc = 0;
    for (int x : nums) acc ^= x;
    return acc;
}
// ---- checks ----
int main() {
    assert(singleNumber({4, 1, 2, 1, 2}) == 4);
    assert(singleNumber({2, 2, 1}) == 1);
    assert(singleNumber({1}) == 1);
    // negatives cancel the same way
    assert(singleNumber({-3, 7, 7}) == -3);
    assert(singleNumber({5, -3, 5}) == -3);
    // the answer can be 0
    assert(singleNumber({0, 5, 5}) == 0);
    // pairs don't have to be next to each other
    assert(singleNumber({9, 1, 9, 3, 1, 8, 3}) == 8);
    return 0;
}
