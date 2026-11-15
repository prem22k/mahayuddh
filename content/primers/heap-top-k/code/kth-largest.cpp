#include <cassert>
#include <functional>
#include <queue>
#include <vector>
using namespace std;
// ---- code ----
int findKthLargest(const vector<int>& nums, int k) {
    // min-heap of the k largest values seen so far
    priority_queue<int, vector<int>, greater<int>> heap;
    for (int x : nums) {
        heap.push(x);
        // one too many: the smallest can't be in the top k
        if ((int)heap.size() > k) heap.pop();
    }
    // the smallest of the k largest is the kth largest
    return heap.top();
}
// ---- checks ----
int main() {
    assert(findKthLargest({3, 2, 1, 5, 6, 4}, 2) == 5);
    assert(findKthLargest({3, 2, 3, 1, 2, 4, 5, 5, 6}, 4) == 4);
    assert(findKthLargest({7}, 1) == 7);
    // k = n is the minimum; k = 1 is the maximum
    assert(findKthLargest({4, -1, 9, 0}, 4) == -1);
    assert(findKthLargest({4, -1, 9, 0}, 1) == 9);
    // duplicates count separately
    assert(findKthLargest({5, 5, 5, 1}, 3) == 5);
    return 0;
}
