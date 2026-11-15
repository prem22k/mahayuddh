#include <algorithm>
#include <cassert>
#include <set>
#include <vector>
using namespace std;
// ---- code ----
void backtrack(const vector<int>& nums, int start,
               vector<int>& path, vector<vector<int>>& out) {
    out.push_back(path);
    for (int i = start; i < (int)nums.size(); i++) {
        // same value as the last choice at this depth:
        // its whole subtree was already built, so skip it
        if (i > start && nums[i] == nums[i - 1]) continue;
        path.push_back(nums[i]);
        backtrack(nums, i + 1, path, out);
        path.pop_back();
    }
}

vector<vector<int>> subsetsWithDup(vector<int> nums) {
    // sorting puts equal values next to each other
    sort(nums.begin(), nums.end());
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
    assert(sorted(subsetsWithDup({1, 2, 2})) == sorted({{}, {1}, {1, 2}, {1, 2, 2}, {2}, {2, 2}}));
    assert(sorted(subsetsWithDup({0})) == sorted({{}, {0}}));
    // all equal: one subset per count, 0 to 3
    assert(sorted(subsetsWithDup({5, 5, 5})) == sorted({{}, {5}, {5, 5}, {5, 5, 5}}));
    // unsorted input: the skip only sees duplicates after sorting
    auto got = subsetsWithDup({4, 4, 4, 1, 4});
    assert(got.size() == 10);
    assert(set<vector<int>>(got.begin(), got.end()).size() == 10);
    assert(sorted(got) == sorted({{}, {1}, {1, 4}, {1, 4, 4}, {1, 4, 4, 4}, {1, 4, 4, 4, 4},
                                  {4}, {4, 4}, {4, 4, 4}, {4, 4, 4, 4}}));
    return 0;
}
