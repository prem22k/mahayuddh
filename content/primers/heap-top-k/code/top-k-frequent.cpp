#include <algorithm>
#include <cassert>
#include <functional>
#include <queue>
#include <unordered_map>
#include <utility>
#include <vector>
using namespace std;
// ---- code ----
vector<int> topKFrequent(const vector<int>& nums, int k) {
    // how often each value appears
    unordered_map<int, int> count;
    for (int x : nums) ++count[x];
    // min-heap of (frequency, value), at most k entries
    priority_queue<pair<int, int>, vector<pair<int, int>>,
                   greater<pair<int, int>>> heap;
    for (const auto& [x, c] : count) {
        heap.push({c, x});
        // drop the least frequent of the k + 1
        if ((int)heap.size() > k) heap.pop();
    }
    vector<int> out;
    while (!heap.empty()) {
        out.push_back(heap.top().second);
        heap.pop();
    }
    return out;
}
// ---- checks ----
vector<int> sorted(vector<int> v) {
    sort(v.begin(), v.end());
    return v;
}

int main() {
    assert((sorted(topKFrequent({1, 1, 1, 2, 2, 3}, 2)) == vector<int>{1, 2}));
    assert((topKFrequent({1}, 1) == vector<int>{1}));
    // every value once except 4: k = 1 must pick 4
    assert((topKFrequent({3, 4, 4, 1, 2}, 1) == vector<int>{4}));
    // k equals the number of distinct values
    assert((sorted(topKFrequent({5, -1, 5, -1, 7}, 3)) == vector<int>{-1, 5, 7}));
    // frequencies run against value order
    assert((sorted(topKFrequent({9, 9, 9, 1, 1, 2, 3}, 2)) == vector<int>{1, 9}));
    return 0;
}
