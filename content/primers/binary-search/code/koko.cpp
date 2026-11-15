#include <algorithm>
#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
long long hoursNeeded(const vector<int>& piles, int k) {
    // each pile takes ceil(pile / k) hours
    long long hours = 0;
    for (int p : piles) hours += (p + (long long)k - 1) / k;
    return hours;
}

int minEatingSpeed(const vector<int>& piles, int h) {
    // "speed k is fast enough" goes false ... false,
    // true ... true as k grows: find the first true
    int lo = 1, hi = *max_element(piles.begin(), piles.end());
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (hoursNeeded(piles, mid) <= h) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}
// ---- checks ----
int main() {
    assert(minEatingSpeed({3, 6, 7, 11}, 8) == 4);
    assert(minEatingSpeed({30, 11, 23, 4, 20}, 5) == 30);
    assert(minEatingSpeed({30, 11, 23, 4, 20}, 6) == 23);
    assert(minEatingSpeed({5}, 10) == 1);
    assert(minEatingSpeed({1000000000}, 2) == 500000000);
    assert(hoursNeeded({1000000000, 1000000000, 1000000000, 1000000000, 1000000000}, 1) == 5000000000LL);
    assert(minEatingSpeed({1000000000, 1000000000, 1000000000, 1000000000, 1000000000}, 1000000000) == 5);
    return 0;
}
