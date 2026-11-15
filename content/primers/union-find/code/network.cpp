#include <cassert>
#include <numeric>
#include <utility>
#include <vector>
using namespace std;

struct DSU {
    vector<int> parent, size;

    DSU(int n) : parent(n), size(n, 1) {
        // each node starts as the root of its own group
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int x) {
        // path compression: point x straight at its root
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    // false if a and b were already in one group
    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        // union by size: the smaller group goes under
        if (size[ra] < size[rb]) swap(ra, rb);
        parent[rb] = ra;
        size[ra] += size[rb];
        return true;
    }
};
// ---- code ----
int makeConnected(int n, vector<vector<int>>& connections) {
    // joining n computers needs at least n - 1 cables
    if ((int)connections.size() < n - 1) return -1;
    DSU dsu(n);
    int groups = n;
    for (auto& c : connections) {
        // each real merge turns two groups into one
        if (dsu.unite(c[0], c[1])) groups--;
    }
    // one moved cable joins two groups
    return groups - 1;
}
// ---- checks ----
int run(int n, vector<vector<int>> c) { return makeConnected(n, c); }

int main() {
    assert(run(4, {{0, 1}, {0, 2}, {1, 2}}) == 1);
    assert(run(6, {{0, 1}, {0, 2}, {0, 3}, {1, 2}, {1, 3}}) == 2);
    assert(run(6, {{0, 1}, {0, 2}, {0, 3}, {1, 2}}) == -1);
    // already connected
    assert(run(3, {{0, 1}, {1, 2}}) == 0);
    assert(run(1, {}) == 0);
    // enough cables, but all inside one group: move them
    assert(run(5, {{0, 1}, {1, 2}, {2, 0}, {0, 3}}) == 1);
    return 0;
}
