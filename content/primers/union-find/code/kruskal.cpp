#include <algorithm>
#include <array>
#include <cassert>
#include <cstdlib>
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
int minCostConnectPoints(vector<vector<int>>& points) {
    int n = points.size();
    vector<array<int, 3>> edges;
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            int d = abs(points[i][0] - points[j][0])
                  + abs(points[i][1] - points[j][1]);
            edges.push_back({d, i, j});
        }
    }
    // cheapest edges first
    sort(edges.begin(), edges.end());
    DSU dsu(n);
    int total = 0, used = 0;
    for (auto& [d, i, j] : edges) {
        // an edge inside one group would make a cycle
        if (dsu.unite(i, j)) {
            total += d;
            used++;
            // a tree on n points has n - 1 edges
            if (used == n - 1) break;
        }
    }
    return total;
}
// ---- checks ----
int run(vector<vector<int>> p) { return minCostConnectPoints(p); }

int main() {
    assert(run({{0, 0}, {2, 2}, {3, 10}, {5, 2}, {7, 0}}) == 20);
    assert(run({{3, 12}, {-2, 5}, {-4, 1}}) == 18);
    assert(run({{0, 0}}) == 0);
    assert(run({{0, 0}, {1, 1}, {1, 0}, {-1, 1}}) == 4);
    // many equal edges: any choice gives the same total
    assert(run({{0, 0}, {0, 1}, {1, 0}, {1, 1}}) == 3);
    return 0;
}
