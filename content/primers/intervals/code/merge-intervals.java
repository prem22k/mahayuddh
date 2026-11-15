import java.util.*;
// ---- code ----
class Solution {
    public int[][] merge(int[][] intervals) {
        // sort by start: overlaps end up side by side
        Arrays.sort(intervals,
            (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> merged = new ArrayList<>();
        for (int[] iv : intervals) {
            int start = iv[0], end = iv[1];
            int[] last = merged.isEmpty()
                ? null : merged.get(merged.size() - 1);
            // starts after the last block ends: a new block
            if (last == null || start > last[1]) {
                merged.add(new int[]{start, end});
            } else {
                // overlaps: grow the end, never shrink it
                last[1] = Math.max(last[1], end);
            }
        }
        return merged.toArray(new int[0][]);
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static boolean same(int[][] got, int[][] want) { return Arrays.deepEquals(got, want); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(same(s.merge(new int[][]{{2, 3}, {1, 5}, {6, 8}, {7, 7}}),
            new int[][]{{1, 5}, {6, 8}}), "walkthrough");
        check(same(s.merge(new int[][]{{1, 3}, {2, 6}, {8, 10}, {15, 18}}),
            new int[][]{{1, 6}, {8, 10}, {15, 18}}), "example 1");
        // touching ends count as overlapping
        check(same(s.merge(new int[][]{{1, 4}, {4, 5}}), new int[][]{{1, 5}}), "touching");
        check(same(s.merge(new int[][]{{1, 4}}), new int[][]{{1, 4}}), "single");
        // unsorted input, and one interval swallows the rest
        check(same(s.merge(new int[][]{{4, 7}, {1, 10}, {2, 3}}), new int[][]{{1, 10}}), "swallow");
        check(same(s.merge(new int[][]{{5, 6}, {1, 2}, {3, 4}}),
            new int[][]{{1, 2}, {3, 4}, {5, 6}}), "disjoint");
    }
}
