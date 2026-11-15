#include <cassert>
#include <numeric>
#include <string>
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
bool equationsPossible(vector<string>& equations) {
    DSU dsu(26);
    // pass 1: join every pair that must be equal
    for (const string& e : equations) {
        if (e[1] == '=') {
            int x = e[0] - 'a';
            int y = e[3] - 'a';
            dsu.unite(x, y);
        }
    }
    // pass 2: no "!=" may sit inside one group
    for (const string& e : equations) {
        if (e[1] == '!') {
            int x = e[0] - 'a';
            int y = e[3] - 'a';
            if (dsu.find(x) == dsu.find(y)) return false;
        }
    }
    return true;
}
// ---- checks ----
bool run(vector<string> eq) { return equationsPossible(eq); }

int main() {
    assert(!run({"a==b", "b!=a"}));
    assert(run({"b==a", "a==b"}));
    assert(!run({"a!=a"}));
    assert(run({"a==a"}));
    // the "!=" comes first, so one pass would miss it
    assert(!run({"a!=b", "b==c", "c==a"}));
    // equality chains through c
    assert(!run({"a==c", "c==b", "a!=b"}));
    assert(run({"a==b", "c==d", "a!=d"}));
    return 0;
}
