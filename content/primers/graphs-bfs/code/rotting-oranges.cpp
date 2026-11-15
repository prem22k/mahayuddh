#include <cassert>
#include <queue>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
int orangesRotting(vector<vector<int>>& grid) {
    int rows = grid.size(), cols = grid[0].size();
    queue<pair<int, int>> q;
    int fresh = 0;
    // every rotten orange starts in the queue at minute 0
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == 2) {
                q.push({r, c});
            } else if (grid[r][c] == 1) {
                fresh++;
            }
        }
    }
    int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
    int minutes = 0;
    while (!q.empty() && fresh > 0) {
        // one round of the loop is one minute
        for (int k = q.size(); k > 0; k--) {
            auto [r, c] = q.front();
            q.pop();
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr >= 0 && nr < rows
                        && nc >= 0 && nc < cols
                        && grid[nr][nc] == 1) {
                    // rotting it also marks it as seen
                    grid[nr][nc] = 2;
                    fresh--;
                    q.push({nr, nc});
                }
            }
        }
        minutes++;
    }
    return fresh == 0 ? minutes : -1;
}
// ---- checks ----
int run(vector<vector<int>> g) { return orangesRotting(g); }

int main() {
    assert(run({{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}) == 4);
    assert(run({{2, 1, 1}, {0, 1, 1}, {1, 0, 1}}) == -1);
    assert(run({{0, 2}}) == 0);
    // nothing fresh at all: 0 minutes, not -1
    assert(run({{0}}) == 0);
    // fresh but nothing rotten: never
    assert(run({{1}}) == -1);
    // two sources spread at once and meet in the middle
    assert(run({{2, 1, 1, 1, 2}}) == 2);
    assert(run({{2, 1, 1, 1, 1}}) == 4);
    return 0;
}
