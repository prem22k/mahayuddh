#include <algorithm>
#include <cassert>
#include <climits>
#include <functional>
#include <queue>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
int networkDelayTime(const vector<vector<int>>& times,
                     int n, int k) {
    vector<vector<pair<int, int>>> graph(n + 1);
    for (const auto& t : times) {
        graph[t[0]].push_back({t[1], t[2]});
    }
    vector<int> dist(n + 1, INT_MAX);
    dist[k] = 0;
    // (distance so far, node); the smallest pops first
    using P = pair<int, int>;
    priority_queue<P, vector<P>, greater<P>> heap;
    heap.push({0, k});
    while (!heap.empty()) {
        auto [d, u] = heap.top();
        heap.pop();
        // a stale entry: u was already reached more cheaply
        if (d > dist[u]) continue;
        // d is final for u; try every edge out of it
        for (auto [v, w] : graph[u]) {
            if (d + w < dist[v]) {
                dist[v] = d + w;
                heap.push({dist[v], v});
            }
        }
    }
    int best = 0;
    for (int i = 1; i <= n; i++) {
        // a node never reached: the signal can't get there
        if (dist[i] == INT_MAX) return -1;
        best = max(best, dist[i]);
    }
    return best;
}
// ---- checks ----
int main() {
    vector<vector<int>> walk = {
        {1, 2, 4}, {1, 3, 1}, {3, 2, 2}, {2, 4, 1}, {3, 4, 5}};
    assert(networkDelayTime(walk, 4, 1) == 4);
    assert(networkDelayTime({{2, 1, 1}, {2, 3, 1}, {3, 4, 1}}, 4, 2) == 2);
    assert(networkDelayTime({{1, 2, 1}}, 2, 1) == 1);
    // edges are directed: 2 can't reach 1
    assert(networkDelayTime({{1, 2, 1}}, 2, 2) == -1);
    assert(networkDelayTime({}, 1, 1) == 0);
    // a cycle, and a direct edge that is not the shortest way
    vector<vector<int>> cyc = {{1, 2, 1}, {2, 1, 1}, {2, 3, 5}, {1, 3, 10}};
    assert(networkDelayTime(cyc, 3, 1) == 6);
    // one node cut off among reachable ones
    assert(networkDelayTime({{1, 2, 3}, {2, 3, 3}}, 4, 1) == -1);
    return 0;
}
