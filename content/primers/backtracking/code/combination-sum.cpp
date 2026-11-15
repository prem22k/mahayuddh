#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
void backtrack(const vector<int>& nums, int start, int remain,
               vector<int>& path, vector<vector<int>>& out) {
    if (remain == 0) {
        out.push_back(path);
        return;
    }
    for (int i = start; i < (int)nums.size(); i++) {
        // prune: this branch and every later one overshoot
        if (nums[i] > remain) break;
        path.push_back(nums[i]);
        // i, not i + 1: the same number can be used again
        backtrack(nums, i, remain - nums[i], path, out);
        path.pop_back();
    }
}

vector<vector<int>> combinationSum(vector<int> candidates,
                                   int target) {
    // sorted, so one number too big means the rest are too
    sort(candidates.begin(), candidates.end());
    vector<vector<int>> out;
    vector<int> path;
    backtrack(candidates, 0, target, path, out);
    return out;
}
// ---- checks ----
vector<vector<int>> sorted(vector<vector<int>> xs) {
    sort(xs.begin(), xs.end());
    return xs;
}

int main() {
    assert(sorted(combinationSum({2, 3, 6, 7}, 7)) == sorted({{2, 2, 3}, {7}}));
    assert(sorted(combinationSum({2, 3, 5}, 8)) == sorted({{2, 2, 2, 2}, {2, 3, 3}, {3, 5}}));
    assert(combinationSum({2}, 1).empty());
    assert((combinationSum({1}, 2) == vector<vector<int>>{{1, 1}}));
    // unsorted input: the early break only works after sorting
    assert(sorted(combinationSum({7, 3, 2}, 7)) == sorted({{2, 2, 3}, {7}}));
    assert(sorted(combinationSum({8, 4, 2}, 8)) == sorted({{2, 2, 2, 2}, {2, 2, 4}, {4, 4}, {8}}));
    return 0;
}
