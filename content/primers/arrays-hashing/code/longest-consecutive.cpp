#include <algorithm>
#include <cassert>
#include <unordered_set>
#include <vector>
using namespace std;
// ---- code ----
int longestConsecutive(const vector<int>& nums) {
    unordered_set<int> present(nums.begin(), nums.end());
    int best = 0;
    for (int x : present) {
        // only count from the first number of a run
        if (present.count(x - 1)) continue;
        int length = 1;
        while (present.count(x + length)) ++length;
        best = max(best, length);
    }
    return best;
}
// ---- checks ----
int main() {
    assert(longestConsecutive({100, 4, 200, 1, 3, 2}) == 4);
    assert(longestConsecutive({0, 3, 7, 2, 5, 8, 4, 6, 0, 1}) == 9);
    assert(longestConsecutive({}) == 0);
    assert(longestConsecutive({5}) == 1);
    assert(longestConsecutive({1, 2, 0, 1}) == 3);
    assert(longestConsecutive({-1, 0, 1, 10}) == 3);
    return 0;
}
