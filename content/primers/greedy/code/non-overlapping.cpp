#include <algorithm>
#include <cassert>
#include <climits>
#include <vector>
using namespace std;
// ---- code ----
int eraseOverlapIntervals(vector<vector<int>> intervals) {
    // earliest end first: it leaves the most room after it
    sort(intervals.begin(), intervals.end(),
         [](const vector<int>& a, const vector<int>& b) {
             return a[1] < b[1];
         });
    int removed = 0;
    int end = INT_MIN;
    for (const auto& iv : intervals) {
        int start = iv[0], finish = iv[1];
        if (start >= end) {
            // fits after the last kept interval: keep it
            end = finish;
        } else {
            // clashes with one that ends sooner: drop it
            ++removed;
        }
    }
    return removed;
}
// ---- checks ----
int main() {
    assert(eraseOverlapIntervals({{1, 10}, {2, 3}, {4, 5}, {6, 7}}) == 1);
    assert(eraseOverlapIntervals({{1, 2}, {2, 3}, {3, 4}, {1, 3}}) == 1);
    assert(eraseOverlapIntervals({{1, 2}, {1, 2}, {1, 2}}) == 2);
    assert(eraseOverlapIntervals({{1, 2}, {2, 3}}) == 0);
    assert(eraseOverlapIntervals({{5, 9}}) == 0);
    // sorting by start would keep [1, 100] and lose two
    assert(eraseOverlapIntervals({{1, 100}, {11, 22}, {1, 11}, {2, 12}}) == 2);
    assert(eraseOverlapIntervals({{-3, 0}, {-1, 1}, {0, 2}, {1, 3}}) == 2);
    return 0;
}
