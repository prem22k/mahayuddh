#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int jump(const vector<int>& nums) {
    int jumps = 0;
    // this many jumps reach up to index end
    int end = 0;
    // one more jump could reach up to farthest
    int farthest = 0;
    for (int i = 0; i + 1 < (int)nums.size(); ++i) {
        farthest = max(farthest, i + nums[i]);
        // at the edge of this jump's reach: take another
        if (i == end) {
            ++jumps;
            end = farthest;
        }
    }
    return jumps;
}
// ---- checks ----
int main() {
    assert(jump({2, 3, 1, 1, 4}) == 2);
    assert(jump({2, 3, 0, 1, 4}) == 2);
    assert(jump({0}) == 0);
    assert(jump({1, 1, 1, 1}) == 3);
    // one big jump covers everything
    assert(jump({9, 1, 1, 1, 1}) == 1);
    // jumping as far as possible first is the trap
    assert(jump({3, 1, 4, 1, 1, 1, 1}) == 2);
    return 0;
}
