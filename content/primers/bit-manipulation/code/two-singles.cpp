#include <algorithm>
#include <cassert>
#include <climits>
#include <vector>
using namespace std;
// ---- code ----
vector<int> singleNumber(const vector<int>& nums) {
    // pairs cancel, so both = a ^ b. Since a != b, both has
    // a 1 bit somewhere a and b differ
    unsigned both = 0;
    for (int x : nums) both ^= (unsigned)x;
    // x & -x keeps only the lowest 1 bit of x (unsigned,
    // so -x can't overflow)
    unsigned low = both & -both;
    unsigned a = 0;
    for (int x : nums) {
        // split on that bit: a and b go to different sides,
        // and the two copies of a pair go to the same side
        if ((unsigned)x & low) a ^= (unsigned)x;
    }
    return {(int)a, (int)(both ^ a)};
}
// ---- checks ----
vector<int> sorted(vector<int> xs) {
    sort(xs.begin(), xs.end());
    return xs;
}

int main() {
    assert((sorted(singleNumber({1, 2, 1, 3, 2, 5})) == vector<int>{3, 5}));
    assert((sorted(singleNumber({-1, 0})) == vector<int>{-1, 0}));
    assert((sorted(singleNumber({0, 1})) == vector<int>{0, 1}));
    // they differ only in a higher bit: 2 = 010, 6 = 110
    assert((sorted(singleNumber({2, 6, 4, 4})) == vector<int>{2, 6}));
    // the lowest differing bit is the sign bit
    assert((sorted(singleNumber({INT_MIN, 0})) == vector<int>{INT_MIN, 0}));
    assert((sorted(singleNumber({INT_MIN, 7, INT_MAX, 7})) == vector<int>{INT_MIN, INT_MAX}));
    return 0;
}
