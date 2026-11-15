#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int twoCitySchedCost(vector<vector<int>> costs) {
    // most money saved by flying to A, relative to B, first
    sort(costs.begin(), costs.end(),
         [](const vector<int>& x, const vector<int>& y) {
             return x[0] - x[1] < y[0] - y[1];
         });
    int n = costs.size() / 2;
    int total = 0;
    for (int i = 0; i < (int)costs.size(); ++i) {
        // first half flies to A, second half to B
        total += i < n ? costs[i][0] : costs[i][1];
    }
    return total;
}
// ---- checks ----
int main() {
    assert(twoCitySchedCost({{10, 20}, {30, 200}, {400, 50}, {30, 20}}) == 110);
    assert(twoCitySchedCost({{259, 770}, {448, 54}, {926, 667}, {184, 139}, {840, 118}, {577, 469}}) == 1859);
    assert(twoCitySchedCost({{5, 9}, {2, 1}}) == 6);
    // A is cheaper for everyone, but only half may go
    assert(twoCitySchedCost({{1, 100}, {2, 50}, {3, 10}, {4, 5}}) == 1 + 2 + 10 + 5);
    return 0;
}
