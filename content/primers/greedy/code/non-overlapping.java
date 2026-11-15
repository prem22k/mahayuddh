import java.util.*;
// ---- code ----
class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        // earliest end first: it leaves the most room after it
        Arrays.sort(intervals,
            (a, b) -> Integer.compare(a[1], b[1]));
        int removed = 0;
        int end = Integer.MIN_VALUE;
        for (int[] iv : intervals) {
            int start = iv[0], finish = iv[1];
            if (start >= end) {
                // fits after the last kept interval: keep it
                end = finish;
            } else {
                // clashes with one that ends sooner: drop it
                removed++;
            }
        }
        return removed;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.eraseOverlapIntervals(new int[][]{{1, 10}, {2, 3}, {4, 5}, {6, 7}}) == 1, "walkthrough");
        check(s.eraseOverlapIntervals(new int[][]{{1, 2}, {2, 3}, {3, 4}, {1, 3}}) == 1, "example 1");
        check(s.eraseOverlapIntervals(new int[][]{{1, 2}, {1, 2}, {1, 2}}) == 2, "example 2");
        check(s.eraseOverlapIntervals(new int[][]{{1, 2}, {2, 3}}) == 0, "touching");
        check(s.eraseOverlapIntervals(new int[][]{{5, 9}}) == 0, "single");
        // sorting by start would keep [1, 100] and lose two
        check(s.eraseOverlapIntervals(new int[][]{{1, 100}, {11, 22}, {1, 11}, {2, 12}}) == 2, "long first");
        check(s.eraseOverlapIntervals(new int[][]{{-3, 0}, {-1, 1}, {0, 2}, {1, 3}}) == 2, "negatives");
    }
}
