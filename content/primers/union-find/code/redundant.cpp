#include <cassert>
#include <numeric>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
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

vector<int> findRedundantConnection(
        vector<vector<int>>& edges) {
    // nodes are 1..n and there are n edges
    DSU dsu(edges.size() + 1);
    for (auto& e : edges) {
        // already connected: this edge closes a cycle
        if (!dsu.unite(e[0], e[1])) return {e[0], e[1]};
    }
    return {};
}
// ---- checks ----
vector<int> run(vector<vector<int>> edges) { return findRedundantConnection(edges); }

int main() {
    // the walkthrough
    assert((run({{1, 2}, {3, 4}, {2, 4}, {5, 6}, {4, 6}, {1, 5}}) == vector<int>{1, 5}));
    assert((run({{1, 2}, {1, 3}, {2, 3}}) == vector<int>{2, 3}));
    assert((run({{1, 2}, {2, 3}, {3, 4}, {1, 4}, {1, 5}}) == vector<int>{1, 4}));
    // the cycle closes on the very last edge
    assert((run({{1, 2}, {2, 3}, {3, 1}}) == vector<int>{3, 1}));

    // the DSU itself: path compression and union by size
    DSU d(6);
    assert(d.unite(1, 2) && d.unite(3, 4) && d.unite(2, 4));
    assert(d.find(4) == 1 && d.parent[4] == 1);
    assert(d.size[1] == 4);
    assert(!d.unite(3, 2));
    // a group of 1 hangs under the bigger group's root
    assert(d.unite(5, 3) && d.find(5) == 1);
    assert(d.find(0) == 0);
    return 0;
}
