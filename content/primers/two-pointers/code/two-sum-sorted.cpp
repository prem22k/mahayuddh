#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<int> twoSum(const vector<int>& numbers, int target) {
    int left = 0, right = (int)numbers.size() - 1;
    while (left < right) {
        int s = numbers[left] + numbers[right];
        if (s == target) {
            // the problem wants 1-based indices
            return {left + 1, right + 1};
        }
        if (s < target) {
            // too small even with the largest partner,
            // so numbers[left] fits no answer: drop it
            ++left;
        } else {
            // too big even with the smallest partner,
            // so numbers[right] fits no answer: drop it
            --right;
        }
    }
    return {};
}
// ---- checks ----
int main() {
    assert((twoSum({1, 3, 4, 6, 8, 11}, 10) == vector<int>{3, 4}));
    assert((twoSum({2, 7, 11, 15}, 9) == vector<int>{1, 2}));
    assert((twoSum({2, 3, 4}, 6) == vector<int>{1, 3}));
    assert((twoSum({-1, 0}, -1) == vector<int>{1, 2}));
    assert(twoSum({5}, 10).empty());
    assert(twoSum({}, 0).empty());
    assert((twoSum({1, 2, 3, 4, 4, 9, 56, 90}, 8) == vector<int>{4, 5}));
    return 0;
}
