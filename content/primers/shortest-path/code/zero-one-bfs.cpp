#include <cassert>
#include <climits>
#include <deque>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
int minimumObstacles(const vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    vector<vector<int>> dist(m, vector<int>(n, INT_MAX));
    dist[0][0] = 0;
    deque<pair<int, int>> dq;
    dq.push_back({0, 0});
    int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    while (!dq.empty()) {
        auto [r, c] = dq.front();
        dq.pop_front();
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= m || nc < 0 || nc >= n) {
                continue;
            }
            // entering an obstacle costs 1, a free cell 0
            int nd = dist[r][c] + grid[nr][nc];
            if (nd < dist[nr][nc]) {
                dist[nr][nc] = nd;
                // cost 0: front of the deque; cost 1: back
                if (grid[nr][nc] == 0) {
                    dq.push_front({nr, nc});
                } else {
                    dq.push_back({nr, nc});
                }
            }
        }
    }
    return dist[m - 1][n - 1];
}
// ---- checks ----
int main() {
    assert(minimumObstacles({{0, 1, 1}, {1, 1, 0}, {1, 1, 0}}) == 2);
    assert(minimumObstacles({{0, 1, 0, 0, 0}, {0, 1, 0, 1, 0}, {0, 0, 0, 1, 0}}) == 0);
    assert(minimumObstacles({{0}}) == 0);
    assert(minimumObstacles({{0, 1}, {1, 0}}) == 1);
    // a long free detour beats a short wall
    assert(minimumObstacles({{0, 1, 0}, {0, 1, 0}, {0, 0, 0}}) == 0);
    // a wall you must cross somewhere
    assert(minimumObstacles({{0, 0, 0}, {1, 1, 1}, {0, 0, 0}}) == 1);
    return 0;
}
