#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int removeDuplicates(vector<int>& nums) {
    // nums[0..write-1] holds the values kept so far
    int write = 0;
    for (int read = 0; read < (int)nums.size(); ++read) {
        // sorted, so a new value differs from the last kept
        if (write == 0 || nums[read] != nums[write - 1]) {
            nums[write] = nums[read];
            ++write;
        }
    }
    return write;
}
// ---- checks ----
int main() {
    vector<int> a = {1, 1, 2};
    assert(removeDuplicates(a) == 2 && a[0] == 1 && a[1] == 2);
    a = {0, 0, 1, 1, 1, 2, 2, 3, 3, 4};
    assert(removeDuplicates(a) == 5);
    assert((vector<int>(a.begin(), a.begin() + 5) == vector<int>{0, 1, 2, 3, 4}));
    a = {};
    assert(removeDuplicates(a) == 0);
    a = {7};
    assert(removeDuplicates(a) == 1 && a[0] == 7);
    a = {-3, -3, -3};
    assert(removeDuplicates(a) == 1 && a[0] == -3);
    a = {1, 2, 3};
    assert(removeDuplicates(a) == 3 && (a == vector<int>{1, 2, 3}));
    return 0;
}
