#include <cassert>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
long long atMost(const vector<int>& nums, int k) {
    unordered_map<int, int> count;
    long long total = 0;
    int left = 0;
    for (int right = 0; right < (int)nums.size(); ++right) {
        ++count[nums[right]];
        // too many distinct: shrink
        while ((int)count.size() > k) {
            if (--count[nums[left]] == 0) {
                count.erase(nums[left]);
            }
            ++left;
        }
        // every window that ends at right
        total += right - left + 1;
    }
    return total;
}

int subarraysWithKDistinct(const vector<int>& nums, int k) {
    // exactly k = at most k − at most k−1
    return atMost(nums, k) - atMost(nums, k - 1);
}
// ---- checks ----
int main() {
    assert(subarraysWithKDistinct({1, 2, 1, 2, 3}, 2) == 7);
    assert(subarraysWithKDistinct({1, 2, 1, 3, 4}, 3) == 3);
    assert(subarraysWithKDistinct({1}, 1) == 1);
    return 0;
}
