#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
// true if a cycle can be reached from u
bool hasCycle(int u, vector<vector<int>>& graph,
              vector<int>& state) {
    if (state[u] == 1) {
        // back on the current path: a cycle
        return true;
    }
    if (state[u] == 2) {
        // fully checked before: no cycle through here
        return false;
    }
    state[u] = 1;
    for (int v : graph[u]) {
        if (hasCycle(v, graph, state)) return true;
    }
    state[u] = 2;
    return false;
}

bool canFinish(int numCourses,
               vector<vector<int>>& prerequisites) {
    vector<vector<int>> graph(numCourses);
    for (auto& p : prerequisites) graph[p[1]].push_back(p[0]);
    // 0 = not visited, 1 = on the current path, 2 = done
    vector<int> state(numCourses, 0);
    for (int u = 0; u < numCourses; u++) {
        if (hasCycle(u, graph, state)) return false;
    }
    return true;
}
// ---- checks ----
bool run(int n, vector<vector<int>> pre) { return canFinish(n, pre); }

int main() {
    assert(run(2, {{1, 0}}));
    assert(!run(2, {{1, 0}, {0, 1}}));
    assert(run(1, {}));
    // a diamond reaches 3 twice, but that is not a cycle
    assert(run(4, {{1, 0}, {2, 0}, {3, 1}, {3, 2}}));
    // a course that requires itself
    assert(!run(1, {{0, 0}}));
    // the cycle is away from course 0
    assert(!run(4, {{1, 0}, {2, 1}, {3, 2}, {1, 3}}));
    // two separate parts, both fine
    assert(run(4, {{1, 0}, {3, 2}}));
    return 0;
}
