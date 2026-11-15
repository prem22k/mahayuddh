#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<int>> insert(const vector<vector<int>>& intervals,
                           const vector<int>& newInterval) {
    vector<vector<int>> out;
    int i = 0, n = intervals.size();
    // 1. ends before new starts: copy it
    while (i < n && intervals[i][1] < newInterval[0]) {
        out.push_back(intervals[i]);
        ++i;
    }
    // 2. starts before new ends: absorb it into new
    int start = newInterval[0], end = newInterval[1];
    while (i < n && intervals[i][0] <= end) {
        start = min(start, intervals[i][0]);
        end = max(end, intervals[i][1]);
        ++i;
    }
    out.push_back({start, end});
    // 3. everything left starts after new ends
    while (i < n) {
        out.push_back(intervals[i]);
        ++i;
    }
    return out;
}
// ---- checks ----
using VV = vector<vector<int>>;
int main() {
    assert((insert({{1, 3}, {6, 9}}, {2, 5}) == VV{{1, 5}, {6, 9}}));
    assert((insert({{1, 2}, {3, 5}, {6, 7}, {8, 10}, {12, 16}}, {4, 8}) == VV{{1, 2}, {3, 10}, {12, 16}}));
    assert((insert({}, {5, 7}) == VV{{5, 7}}));
    // goes first, goes last, touches a neighbour
    assert((insert({{3, 4}}, {1, 2}) == VV{{1, 2}, {3, 4}}));
    assert((insert({{1, 2}}, {3, 4}) == VV{{1, 2}, {3, 4}}));
    assert((insert({{1, 5}}, {5, 7}) == VV{{1, 7}}));
    // new swallows everything
    assert((insert({{2, 3}, {4, 5}, {6, 7}}, {1, 9}) == VV{{1, 9}}));
    return 0;
}
