#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
int canCompleteCircuit(const vector<int>& gas,
                       const vector<int>& cost) {
    int total = 0, tank = 0, start = 0;
    for (int i = 0; i < (int)gas.size(); ++i) {
        total += gas[i] - cost[i];
        tank += gas[i] - cost[i];
        // stuck before i + 1: no start from start..i works
        if (tank < 0) {
            start = i + 1;
            tank = 0;
        }
    }
    // enough gas overall means the last start survives
    return total >= 0 ? start : -1;
}
// ---- checks ----
int main() {
    assert(canCompleteCircuit({1, 2, 3, 4, 5}, {3, 4, 5, 1, 2}) == 3);
    assert(canCompleteCircuit({2, 3, 4}, {3, 4, 3}) == -1);
    assert(canCompleteCircuit({5}, {4}) == 0);
    assert(canCompleteCircuit({4}, {5}) == -1);
    // exactly enough gas in total
    assert(canCompleteCircuit({1, 1, 3}, {2, 2, 1}) == 2);
    // a tank of exactly zero is not stuck: keep the start
    assert(canCompleteCircuit({2, 3, 1}, {2, 1, 3}) == 0);
    assert(canCompleteCircuit({3, 1, 1}, {1, 2, 2}) == 0);
    return 0;
}
