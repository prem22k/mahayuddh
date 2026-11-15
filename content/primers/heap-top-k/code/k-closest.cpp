#include <algorithm>
#include <cassert>
#include <queue>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<int>> kClosest(const vector<vector<int>>& points,
                             int k) {
    // max-heap of (distance, index): the k closest so far
    priority_queue<pair<int, int>> heap;
    for (int i = 0; i < (int)points.size(); ++i) {
        int x = points[i][0], y = points[i][1];
        int d = x * x + y * y;
        heap.push({d, i});
        // one too many: drop the farthest
        if ((int)heap.size() > k) heap.pop();
    }
    vector<vector<int>> out;
    while (!heap.empty()) {
        out.push_back(points[heap.top().second]);
        heap.pop();
    }
    return out;
}
// ---- checks ----
using VV = vector<vector<int>>;
VV sorted(VV v) {
    sort(v.begin(), v.end());
    return v;
}

int main() {
    assert((kClosest({{1, 3}, {-2, 2}}, 1) == VV{{-2, 2}}));
    assert((sorted(kClosest({{3, 3}, {5, -1}, {-2, 4}}, 2)) == VV{{-2, 4}, {3, 3}}));
    assert((kClosest({{0, 0}}, 1) == VV{{0, 0}}));
    // k = n returns everything
    assert((sorted(kClosest({{1, 0}, {0, 2}, {3, 0}}, 3)) == VV{{0, 2}, {1, 0}, {3, 0}}));
    // the far point comes first and must be dropped later
    assert((sorted(kClosest({{10, 10}, {1, 1}, {0, 1}}, 2)) == VV{{0, 1}, {1, 1}}));
    return 0;
}
