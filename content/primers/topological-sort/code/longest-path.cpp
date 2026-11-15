#include <algorithm>
#include <cassert>
#include <queue>
#include <vector>
using namespace std;
// ---- code ----
int minimumTime(int n, vector<vector<int>>& relations,
                vector<int>& time) {
    vector<vector<int>> graph(n);
    vector<int> indegree(n, 0);
    // courses are 1..n; [a, b] means a before b
    for (auto& r : relations) {
        graph[r[0] - 1].push_back(r[1] - 1);
        indegree[r[1] - 1]++;
    }
    // start[v]: the earliest month v can begin
    vector<int> start(n, 0);
    queue<int> q;
    for (int i = 0; i < n; i++) {
        if (indegree[i] == 0) q.push(i);
    }
    int best = 0;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        int finish = start[u] + time[u];
        best = max(best, finish);
        for (int v : graph[u]) {
            // v waits for its slowest prerequisite
            start[v] = max(start[v], finish);
            indegree[v]--;
            if (indegree[v] == 0) q.push(v);
        }
    }
    return best;
}
// ---- checks ----
int run(int n, vector<vector<int>> rel, vector<int> t) { return minimumTime(n, rel, t); }

int main() {
    assert(run(3, {{1, 3}, {2, 3}}, {3, 2, 5}) == 8);
    assert(run(5, {{1, 5}, {2, 5}, {3, 5}, {3, 4}, {4, 5}}, {1, 2, 3, 4, 5}) == 12);
    assert(run(1, {}, {7}) == 7);
    // no relations: everything runs at once, the longest wins
    assert(run(3, {}, {1, 5, 2}) == 5);
    // the slow branch decides, not the one with more courses
    assert(run(4, {{1, 2}, {2, 3}, {1, 4}}, {1, 1, 1, 9}) == 10);
    return 0;
}
