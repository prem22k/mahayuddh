#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<int>> merge(vector<vector<int>> intervals) {
    // sort by start: overlaps end up side by side
    sort(intervals.begin(), intervals.end(),
         [](const vector<int>& a, const vector<int>& b) {
             return a[0] < b[0];
         });
    vector<vector<int>> merged;
    for (const auto& iv : intervals) {
        int start = iv[0], end = iv[1];
        // starts after the last block ends: a new block
        if (merged.empty() || start > merged.back()[1]) {
            merged.push_back({start, end});
        } else {
            // overlaps: grow the end, never shrink it
            merged.back()[1] = max(merged.back()[1], end);
        }
    }
    return merged;
}
// ---- checks ----
using VV = vector<vector<int>>;
int main() {
    assert((merge({{2, 3}, {1, 5}, {6, 8}, {7, 7}}) == VV{{1, 5}, {6, 8}}));
    assert((merge({{1, 3}, {2, 6}, {8, 10}, {15, 18}}) == VV{{1, 6}, {8, 10}, {15, 18}}));
    // touching ends count as overlapping
    assert((merge({{1, 4}, {4, 5}}) == VV{{1, 5}}));
    assert((merge({{1, 4}}) == VV{{1, 4}}));
    // unsorted input, and one interval swallows the rest
    assert((merge({{4, 7}, {1, 10}, {2, 3}}) == VV{{1, 10}}));
    assert((merge({{5, 6}, {1, 2}, {3, 4}}) == VV{{1, 2}, {3, 4}, {5, 6}}));
    return 0;
}
