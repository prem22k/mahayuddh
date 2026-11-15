#include <algorithm>
#include <cassert>
#include <set>
#include <vector>
using namespace std;
// ---- code ----
void backtrack(const vector<int>& nums, vector<bool>& used,
               vector<int>& path, vector<vector<int>>& out) {
    // a full-length path is one permutation
    if (path.size() == nums.size()) {
        out.push_back(path);
        return;
    }
    // any unused element can go next, so start from 0
    for (int i = 0; i < (int)nums.size(); i++) {
        if (used[i]) continue;
        used[i] = true;
        path.push_back(nums[i]);
        backtrack(nums, used, path, out);
        // undo both changes before trying the next i
        path.pop_back();
        used[i] = false;
    }
}

vector<vector<int>> permute(const vector<int>& nums) {
    vector<vector<int>> out;
    vector<int> path;
    vector<bool> used(nums.size(), false);
    backtrack(nums, used, path, out);
    return out;
}
// ---- checks ----
vector<vector<int>> sorted(vector<vector<int>> xs) {
    sort(xs.begin(), xs.end());
    return xs;
}

int main() {
    vector<vector<int>> want = {{1, 2, 3}, {1, 3, 2}, {2, 1, 3}, {2, 3, 1}, {3, 1, 2}, {3, 2, 1}};
    assert(sorted(permute({1, 2, 3})) == want);
    assert(sorted(permute({0, 1})) == sorted({{0, 1}, {1, 0}}));
    assert(permute({1}) == vector<vector<int>>{{1}});
    // n! results, all different, each a rearrangement of nums
    auto six = permute({5, -1, 0, 7, 2, 9});
    assert(six.size() == 720);
    assert(set<vector<int>>(six.begin(), six.end()).size() == 720);
    for (auto p : six) {
        sort(p.begin(), p.end());
        assert(p == vector<int>({-1, 0, 2, 5, 7, 9}));
    }
    return 0;
}
