import java.util.*;
// ---- code ----
class Solution {
    long hoursNeeded(int[] piles, int k) {
        // each pile takes ceil(pile / k) hours
        long hours = 0;
        for (int p : piles) hours += (p + (long) k - 1) / k;
        return hours;
    }

    public int minEatingSpeed(int[] piles, int h) {
        // "speed k is fast enough" goes false ... false,
        // true ... true as k grows: find the first true
        int lo = 1, hi = Arrays.stream(piles).max().getAsInt();
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
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minEatingSpeed(new int[]{3, 6, 7, 11}, 8) == 4, "example 1");
        check(s.minEatingSpeed(new int[]{30, 11, 23, 4, 20}, 5) == 30, "one pile per hour");
        check(s.minEatingSpeed(new int[]{30, 11, 23, 4, 20}, 6) == 23, "example 3");
        check(s.minEatingSpeed(new int[]{5}, 10) == 1, "plenty of time");
        check(s.minEatingSpeed(new int[]{1000000000}, 2) == 500000000, "big pile");
        check(s.hoursNeeded(new int[]{1000000000, 1000000000, 1000000000, 1000000000, 1000000000}, 1) == 5000000000L, "64-bit hours");
        check(s.minEatingSpeed(new int[]{1000000000, 1000000000, 1000000000, 1000000000, 1000000000}, 1000000000) == 5, "many big piles");
    }
}
