#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
bool validPath(int n, vector<vector<int>>& edges,
               int source, int destination) {
    // adjacency list: graph[u] holds u's neighbours
    vector<vector<int>> graph(n);
    for (auto& e : edges) {
        graph[e[0]].push_back(e[1]);
        graph[e[1]].push_back(e[0]);
    }
    vector<bool> seen(n, false);
    seen[source] = true;
    // a stack makes this DFS; a queue would make it BFS
    vector<int> stack = {source};
    while (!stack.empty()) {
        int u = stack.back();
        stack.pop_back();
        if (u == destination) return true;
        for (int v : graph[u]) {
            if (!seen[v]) {
                seen[v] = true;
                stack.push_back(v);
            }
        }
    }
    return false;
}
// ---- checks ----
bool run(int n, vector<vector<int>> edges, int s, int d) { return validPath(n, edges, s, d); }

int main() {
    assert(run(3, {{0, 1}, {1, 2}, {2, 0}}, 0, 2));
    assert(!run(6, {{0, 1}, {0, 2}, {3, 5}, {5, 4}, {4, 3}}, 0, 5));
    assert(run(1, {}, 0, 0));
    // edges go both ways
    assert(run(2, {{1, 0}}, 0, 1));
    // a cycle must not loop forever
    assert(!run(4, {{0, 1}, {1, 2}, {2, 0}}, 0, 3));
    // a long chain
    vector<vector<int>> chain;
    for (int i = 0; i < 999; i++) chain.push_back({i, i + 1});
    assert(run(1000, chain, 0, 999));
    return 0;
}
