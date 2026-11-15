import java.util.*;
// ---- code ----
class Solution {
    public int[][] insert(int[][] intervals,
                          int[] newInterval) {
        List<int[]> out = new ArrayList<>();
        int i = 0, n = intervals.length;
        // 1. ends before new starts: copy it
        while (i < n && intervals[i][1] < newInterval[0]) {
            out.add(intervals[i]);
            i++;
        }
        // 2. starts before new ends: absorb it into new
        int start = newInterval[0], end = newInterval[1];
        while (i < n && intervals[i][0] <= end) {
            start = Math.min(start, intervals[i][0]);
            end = Math.max(end, intervals[i][1]);
            i++;
        }
        out.add(new int[]{start, end});
        // 3. everything left starts after new ends
        while (i < n) {
            out.add(intervals[i]);
            i++;
        }
        return out.toArray(new int[0][]);
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static boolean same(int[][] got, int[][] want) { return Arrays.deepEquals(got, want); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(same(s.insert(new int[][]{{1, 3}, {6, 9}}, new int[]{2, 5}),
            new int[][]{{1, 5}, {6, 9}}), "example 1");
        check(same(s.insert(new int[][]{{1, 2}, {3, 5}, {6, 7}, {8, 10}, {12, 16}}, new int[]{4, 8}),
            new int[][]{{1, 2}, {3, 10}, {12, 16}}), "example 2");
        check(same(s.insert(new int[][]{}, new int[]{5, 7}), new int[][]{{5, 7}}), "empty");
        // goes first, goes last, touches a neighbour
        check(same(s.insert(new int[][]{{3, 4}}, new int[]{1, 2}),
            new int[][]{{1, 2}, {3, 4}}), "first");
        check(same(s.insert(new int[][]{{1, 2}}, new int[]{3, 4}),
            new int[][]{{1, 2}, {3, 4}}), "last");
        check(same(s.insert(new int[][]{{1, 5}}, new int[]{5, 7}), new int[][]{{1, 7}}), "touch");
        // new swallows everything
        check(same(s.insert(new int[][]{{2, 3}, {4, 5}, {6, 7}}, new int[]{1, 9}),
            new int[][]{{1, 9}}), "swallow");
    }
}
