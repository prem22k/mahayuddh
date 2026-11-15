#include <algorithm>
#include <cassert>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
int minGroups(const vector<vector<int>>& intervals) {
    vector<pair<int, int>> events;
    for (const auto& iv : intervals) {
        events.push_back({iv[0], 1});
        // ends are inclusive: it's gone from right + 1 on
        events.push_back({iv[1] + 1, -1});
    }
    // by time; at a tie, -1 sorts first, so ends go first
    sort(events.begin(), events.end());
    int active = 0, best = 0;
    for (const auto& [time, delta] : events) {
        active += delta;
        // most intervals alive at one moment
        best = max(best, active);
    }
    return best;
}
// ---- checks ----
int main() {
    assert(minGroups({{5, 10}, {6, 8}, {1, 5}, {2, 3}, {1, 10}}) == 3);
    assert(minGroups({{1, 3}, {5, 6}, {8, 10}, {11, 13}}) == 1);
    assert(minGroups({{1, 1}}) == 1);
    // sharing one point is still an overlap here
    assert(minGroups({{1, 2}, {2, 3}}) == 2);
    // right + 1 meets the next start: no overlap
    assert(minGroups({{1, 2}, {3, 4}, {1, 2}}) == 2);
    assert(minGroups({{1, 5}, {1, 5}, {1, 5}}) == 3);
    return 0;
}
