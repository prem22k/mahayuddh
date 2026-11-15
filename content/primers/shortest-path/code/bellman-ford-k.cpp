#include <cassert>
#include <climits>
#include <vector>
using namespace std;
// ---- code ----
int findCheapestPrice(int n, const vector<vector<int>>& flights,
                      int src, int dst, int k) {
    vector<int> cost(n, INT_MAX);
    cost[src] = 0;
    // after r rounds: the cheapest using at most r flights
    for (int round = 0; round <= k; round++) {
        // copy first, so a round adds at most one flight
        vector<int> prev = cost;
        for (const auto& f : flights) {
            int u = f[0], v = f[1], w = f[2];
            if (prev[u] != INT_MAX && prev[u] + w < cost[v]) {
                cost[v] = prev[u] + w;
            }
        }
    }
    return cost[dst] == INT_MAX ? -1 : cost[dst];
}
// ---- checks ----
int main() {
    vector<vector<int>> f1 = {{0, 1, 100}, {1, 2, 100}, {2, 0, 100}, {1, 3, 600}, {2, 3, 200}};
    assert(findCheapestPrice(4, f1, 0, 3, 1) == 700);
    vector<vector<int>> f2 = {{0, 1, 100}, {1, 2, 100}, {0, 2, 500}};
    assert(findCheapestPrice(3, f2, 0, 2, 1) == 200);
    assert(findCheapestPrice(3, f2, 0, 2, 0) == 500);
    assert(findCheapestPrice(3, {{0, 1, 5}}, 0, 2, 2) == -1);
    // without the copy, 0 -> 1 -> 2 sneaks in with k = 0
    vector<vector<int>> f3 = {{0, 1, 1}, {1, 2, 1}, {0, 2, 5}};
    assert(findCheapestPrice(3, f3, 0, 2, 0) == 5);
    assert(findCheapestPrice(3, f3, 0, 2, 1) == 2);
    // more stops allowed than needed is fine
    assert(findCheapestPrice(3, f3, 0, 2, 5) == 2);
    return 0;
}
