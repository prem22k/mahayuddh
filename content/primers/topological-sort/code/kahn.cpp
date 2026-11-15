#include <cassert>
#include <queue>
#include <vector>
using namespace std;
// ---- code ----
vector<int> findOrder(int numCourses,
                      vector<vector<int>>& prerequisites) {
    vector<vector<int>> graph(numCourses);
    vector<int> indegree(numCourses, 0);
    // [a, b] means take b before a: an edge b -> a
    for (auto& p : prerequisites) {
        graph[p[1]].push_back(p[0]);
        indegree[p[0]]++;
    }
    // start with every course that needs nothing
    queue<int> q;
    for (int i = 0; i < numCourses; i++) {
        if (indegree[i] == 0) q.push(i);
    }
    vector<int> order;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        order.push_back(u);
        for (int v : graph[u]) {
            // u is done, so v waits on one course fewer
            indegree[v]--;
            if (indegree[v] == 0) q.push(v);
        }
    }
    // a cycle keeps its courses above 0 forever
    if ((int)order.size() < numCourses) return {};
    return order;
}
// ---- checks ----
vector<int> run(int n, vector<vector<int>> pre) { return findOrder(n, pre); }

bool valid(int n, const vector<vector<int>>& pre, const vector<int>& order) {
    if ((int)order.size() != n) return false;
    vector<int> pos(n, -1);
    for (int i = 0; i < n; i++) {
        if (order[i] < 0 || order[i] >= n || pos[order[i]] != -1) return false;
        pos[order[i]] = i;
    }
    for (auto& p : pre) if (pos[p[1]] >= pos[p[0]]) return false;
    return true;
}

int main() {
    // the walkthrough
    vector<vector<int>> w = {{1, 0}, {2, 0}, {3, 1}, {3, 2}, {4, 3}, {4, 5}};
    assert((run(6, w) == vector<int>{0, 5, 1, 2, 3, 4}));
    assert((run(2, {{1, 0}}) == vector<int>{0, 1}));
    vector<vector<int>> p = {{1, 0}, {2, 0}, {3, 1}, {3, 2}};
    assert(valid(4, p, run(4, p)));
    assert((run(1, {}) == vector<int>{0}));
    assert(run(2, {{1, 0}, {0, 1}}).empty());
    // 0 is free, but 1 -> 2 -> 3 -> 1 is a cycle
    assert(run(4, {{1, 0}, {2, 1}, {3, 2}, {1, 3}}).empty());
    // a course that requires itself
    assert(run(1, {{0, 0}}).empty());
    // no prerequisites at all: every order works
    assert(valid(3, {}, run(3, {})));
    return 0;
}
