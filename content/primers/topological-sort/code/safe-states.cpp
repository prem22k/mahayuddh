#include <cassert>
#include <queue>
#include <vector>
using namespace std;
// ---- code ----
vector<int> eventualSafeNodes(vector<vector<int>>& graph) {
    int n = graph.size();
    // flip every edge: parents[v] lists who points at v
    vector<vector<int>> parents(n);
    vector<int> outdegree(n, 0);
    for (int u = 0; u < n; u++) {
        outdegree[u] = graph[u].size();
        for (int v : graph[u]) parents[v].push_back(u);
    }
    // nodes with no way out are safe; peel back from them
    queue<int> q;
    for (int u = 0; u < n; u++) {
        if (outdegree[u] == 0) q.push(u);
    }
    vector<bool> safe(n, false);
    while (!q.empty()) {
        int v = q.front();
        q.pop();
        safe[v] = true;
        for (int u : parents[v]) {
            outdegree[u]--;
            // every edge out of u now leads to a safe node
            if (outdegree[u] == 0) q.push(u);
        }
    }
    vector<int> result;
    for (int u = 0; u < n; u++) {
        if (safe[u]) result.push_back(u);
    }
    return result;
}
// ---- checks ----
vector<int> run(vector<vector<int>> g) { return eventualSafeNodes(g); }

int main() {
    assert((run({{1, 2}, {2, 3}, {5}, {0}, {5}, {}, {}}) == vector<int>{2, 4, 5, 6}));
    assert((run({{1, 2, 3, 4}, {1, 2}, {3, 4}, {0, 4}, {}}) == vector<int>{4}));
    assert((run({{}}) == vector<int>{0}));
    // a node that points at itself is never safe
    assert((run({{0}, {}}) == vector<int>{1}));
    // one edge into a cycle is enough to be unsafe
    assert((run({{1, 3}, {2}, {1}, {}}) == vector<int>{3}));
    // a chain with no cycle: all safe
    assert((run({{1}, {2}, {3}, {}}) == vector<int>{0, 1, 2, 3}));
    return 0;
}
