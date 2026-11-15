#include <cassert>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
// sink the whole island that (r, c) belongs to
void dfs(vector<vector<char>>& grid, int r, int c) {
    int rows = grid.size(), cols = grid[0].size();
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (grid[r][c] != '1') return;
    // '0' now means water or already visited
    grid[r][c] = '0';
    dfs(grid, r - 1, c);
    dfs(grid, r + 1, c);
    dfs(grid, r, c - 1);
    dfs(grid, r, c + 1);
}

int numIslands(vector<vector<char>>& grid) {
    int rows = grid.size(), cols = grid[0].size();
    int count = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            // land not sunk yet starts a new island
            if (grid[r][c] == '1') {
                count++;
                dfs(grid, r, c);
            }
        }
    }
    return count;
}
// ---- checks ----
int run(const vector<string>& rows) {
    vector<vector<char>> g;
    for (const string& s : rows) g.push_back(vector<char>(s.begin(), s.end()));
    return numIslands(g);
}

int main() {
    assert(run({"11110", "11010", "11000", "00000"}) == 1);
    assert(run({"11000", "11000", "00100", "00011"}) == 3);
    assert(run({"0"}) == 0);
    assert(run({"1"}) == 1);
    // diagonal cells are not connected
    assert(run({"101", "010", "101"}) == 5);
    // a U shape is one island, even though a row scan splits it
    assert(run({"101", "101", "111"}) == 1);
    return 0;
}
