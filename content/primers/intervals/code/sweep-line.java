import java.util.*;
// ---- code ----
class Solution {
    public int minGroups(int[][] intervals) {
        int[][] events = new int[2 * intervals.length][];
        int k = 0;
        for (int[] iv : intervals) {
            events[k++] = new int[]{iv[0], 1};
            // ends are inclusive: it's gone from right + 1 on
            events[k++] = new int[]{iv[1] + 1, -1};
        }
        // by time; at a tie, -1 sorts first, so ends go first
        Arrays.sort(events, (a, b) -> a[0] != b[0]
            ? Integer.compare(a[0], b[0])
            : Integer.compare(a[1], b[1]));
        int active = 0, best = 0;
        for (int[] e : events) {
            active += e[1];
            // most intervals alive at one moment
            best = Math.max(best, active);
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.minGroups(new int[][]{{5, 10}, {6, 8}, {1, 5}, {2, 3}, {1, 10}}) == 3, "example 1");
        check(s.minGroups(new int[][]{{1, 3}, {5, 6}, {8, 10}, {11, 13}}) == 1, "example 2");
        check(s.minGroups(new int[][]{{1, 1}}) == 1, "single");
        // sharing one point is still an overlap here
        check(s.minGroups(new int[][]{{1, 2}, {2, 3}}) == 2, "shared point");
        // right + 1 meets the next start: no overlap
        check(s.minGroups(new int[][]{{1, 2}, {3, 4}, {1, 2}}) == 2, "adjacent");
        check(s.minGroups(new int[][]{{1, 5}, {1, 5}, {1, 5}}) == 3, "identical");
    }
}
