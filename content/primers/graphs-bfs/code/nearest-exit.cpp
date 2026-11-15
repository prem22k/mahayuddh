#include <cassert>
#include <queue>
#include <string>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
int nearestExit(vector<vector<char>>& maze,
                vector<int>& entrance) {
    int rows = maze.size(), cols = maze[0].size();
    vector<vector<bool>> seen(rows, vector<bool>(cols, false));
    int r0 = entrance[0], c0 = entrance[1];
    queue<pair<int, int>> q;
    q.push({r0, c0});
    // mark it seen when it joins the queue, not later
    seen[r0][c0] = true;
    int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
    int steps = 0;
    while (!q.empty()) {
        // everything in the queue now is `steps` moves away
        for (int k = q.size(); k > 0; k--) {
            auto [r, c] = q.front();
            q.pop();
            bool edge = r == 0 || r == rows - 1
                     || c == 0 || c == cols - 1;
            if (edge && !(r == r0 && c == c0)) return steps;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr >= 0 && nr < rows
                        && nc >= 0 && nc < cols
                        && maze[nr][nc] == '.'
                        && !seen[nr][nc]) {
                    seen[nr][nc] = true;
                    q.push({nr, nc});
                }
            }
        }
        steps++;
    }
    return -1;
}
// ---- checks ----
int run(const vector<string>& rows, int r, int c) {
    vector<vector<char>> g;
    for (const string& s : rows) g.push_back(vector<char>(s.begin(), s.end()));
    vector<int> e = {r, c};
    return nearestExit(g, e);
}

int main() {
    // the walkthrough: (2, 1) is a dead end, the exit is (2, 5)
    assert(run({"++++++", "+....+", "+.++..", "++++++"}, 1, 1) == 5);
    assert(run({"++.+", "...+", "+++."}, 1, 2) == 1);
    assert(run({"+++", "...", "+++"}, 1, 0) == 2);
    // the entrance itself never counts as an exit
    assert(run({".+"}, 0, 0) == -1);
    assert(run({"..."}, 0, 0) == 1);
    // walled in: no way out
    assert(run({"+++", "+.+", "+++"}, 1, 1) == -1);
    // two exits, 4 and 5 moves away: BFS finds the nearer
    assert(run({"+++++", "+...+", "+.+..", "+...+", "+++.+"}, 1, 1) == 4);
    return 0;
}
