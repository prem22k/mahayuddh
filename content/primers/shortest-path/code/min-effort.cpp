#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdlib>
#include <functional>
#include <queue>
#include <tuple>
#include <vector>
using namespace std;
// ---- code ----
int minimumEffortPath(const vector<vector<int>>& heights) {
    int m = heights.size(), n = heights[0].size();
    vector<vector<int>> effort(m, vector<int>(n, INT_MAX));
    effort[0][0] = 0;
    // (worst step on the path so far, row, col)
    using T = tuple<int, int, int>;
    priority_queue<T, vector<T>, greater<T>> heap;
    heap.push({0, 0, 0});
    int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    while (!heap.empty()) {
        auto [e, r, c] = heap.top();
        heap.pop();
        if (e > effort[r][c]) continue;
        // the first time the corner pops, it is final
        if (r == m - 1 && c == n - 1) return e;
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= m || nc < 0 || nc >= n) {
                continue;
            }
            int step = abs(heights[nr][nc] - heights[r][c]);
            // a path costs its worst step, not the sum
            int ne = max(e, step);
            if (ne < effort[nr][nc]) {
                effort[nr][nc] = ne;
                heap.push({ne, nr, nc});
            }
        }
    }
    return 0;
}
// ---- checks ----
int main() {
    assert(minimumEffortPath({{1, 2, 2}, {3, 8, 2}, {5, 3, 5}}) == 2);
    assert(minimumEffortPath({{1, 2, 3}, {3, 8, 4}, {5, 3, 5}}) == 1);
    assert(minimumEffortPath({{1, 2, 1, 1, 1},
                              {1, 2, 1, 2, 1},
                              {1, 2, 1, 2, 1},
                              {1, 2, 1, 2, 1},
                              {1, 1, 1, 2, 1}}) == 0);
    assert(minimumEffortPath({{5}}) == 0);
    assert(minimumEffortPath({{1, 10}}) == 9);
    // the lowest sum goes down the left (worst step 6);
    // the lowest worst step goes along the top (4)
    assert(minimumEffortPath({{1, 3, 5}, {1, 9, 9}, {1, 1, 7}}) == 4);
    assert(minimumEffortPath({{1, 100, 1}, {3, 100, 4}, {5, 7, 9}}) == 2);
    return 0;
}
