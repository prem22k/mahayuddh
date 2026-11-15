#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<int>> intervalIntersection(
    const vector<vector<int>>& a,
    const vector<vector<int>>& b) {
    size_t i = 0, j = 0;
    vector<vector<int>> out;
    while (i < a.size() && j < b.size()) {
        // the shared part, if there is one
        int lo = max(a[i][0], b[j][0]);
        int hi = min(a[i][1], b[j][1]);
        if (lo <= hi) out.push_back({lo, hi});
        // the one that ends first can't meet anything else
        if (a[i][1] < b[j][1]) {
            ++i;
        } else {
            ++j;
        }
    }
    return out;
}
// ---- checks ----
using VV = vector<vector<int>>;
int main() {
    assert((intervalIntersection({{0, 2}, {5, 10}, {13, 23}, {24, 25}},
                                 {{1, 5}, {8, 12}, {15, 24}, {25, 26}})
            == VV{{1, 2}, {5, 5}, {8, 10}, {15, 23}, {24, 24}, {25, 25}}));
    assert((intervalIntersection({{1, 3}, {5, 9}}, {}) == VV{}));
    assert((intervalIntersection({}, {{4, 8}}) == VV{}));
    // one interval of b covers several of a
    assert((intervalIntersection({{1, 2}, {4, 5}, {7, 8}}, {{0, 9}}) == VV{{1, 2}, {4, 5}, {7, 8}}));
    assert((intervalIntersection({{1, 2}}, {{3, 4}}) == VV{}));
    assert((intervalIntersection({{3, 7}}, {{3, 7}}) == VV{{3, 7}}));
    return 0;
}
