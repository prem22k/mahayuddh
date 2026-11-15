#include <algorithm>
#include <cassert>
#include <set>
#include <vector>
using namespace std;
// ---- code ----
void backtrack(const vector<int>& nums, int start,
               vector<int>& path, vector<vector<int>>& out) {
    // every node of the tree is a subset: record a copy
    out.push_back(path);
    for (int i = start; i < (int)nums.size(); i++) {
        // choose nums[i]
        path.push_back(nums[i]);
        // only later indexes, so each set appears once
        backtrack(nums, i + 1, path, out);
        // un-choose: the next i starts from the same path
        path.pop_back();
    }
}

vector<vector<int>> subsets(const vector<int>& nums) {
    vector<vector<int>> out;
    vector<int> path;
    backtrack(nums, 0, path, out);
    return out;
}
// ---- checks ----
vector<vector<int>> sorted(vector<vector<int>> xs) {
    sort(xs.begin(), xs.end());
    return xs;
}

int main() {
    // the walkthrough's order, exactly as the recursion records it
    vector<vector<int>> walk = {{}, {1}, {1, 2}, {1, 2, 3}, {1, 3}, {2}, {2, 3}, {3}};
    assert(subsets({1, 2, 3}) == walk);
    assert(sorted(subsets({0})) == sorted({{}, {0}}));
    assert(subsets({}) == vector<vector<int>>{{}});
    // 2^n subsets, all different
    vector<int> nums;
    for (int i = 0; i < 10; i++) nums.push_back(i);
    auto ten = subsets(nums);
    assert(ten.size() == 1024);
    assert(set<vector<int>>(ten.begin(), ten.end()).size() == 1024);
    // negatives and unsorted input keep their input order
    assert(sorted(subsets({3, -1})) == sorted({{}, {3}, {-1}, {3, -1}}));
    return 0;
}
