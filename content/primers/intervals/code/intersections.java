import java.util.*;
// ---- code ----
class Solution {
    public int[][] intervalIntersection(int[][] a, int[][] b) {
        int i = 0, j = 0;
        List<int[]> out = new ArrayList<>();
        while (i < a.length && j < b.length) {
            // the shared part, if there is one
            int lo = Math.max(a[i][0], b[j][0]);
            int hi = Math.min(a[i][1], b[j][1]);
            if (lo <= hi) out.add(new int[]{lo, hi});
            // the one that ends first can't meet anything else
            if (a[i][1] < b[j][1]) {
                i++;
            } else {
                j++;
            }
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
        check(same(s.intervalIntersection(
                new int[][]{{0, 2}, {5, 10}, {13, 23}, {24, 25}},
                new int[][]{{1, 5}, {8, 12}, {15, 24}, {25, 26}}),
            new int[][]{{1, 2}, {5, 5}, {8, 10}, {15, 23}, {24, 24}, {25, 25}}), "example 1");
        check(same(s.intervalIntersection(new int[][]{{1, 3}, {5, 9}}, new int[][]{}),
            new int[][]{}), "b empty");
        check(same(s.intervalIntersection(new int[][]{}, new int[][]{{4, 8}}),
            new int[][]{}), "a empty");
        // one interval of b covers several of a
        check(same(s.intervalIntersection(new int[][]{{1, 2}, {4, 5}, {7, 8}}, new int[][]{{0, 9}}),
            new int[][]{{1, 2}, {4, 5}, {7, 8}}), "cover");
        check(same(s.intervalIntersection(new int[][]{{1, 2}}, new int[][]{{3, 4}}),
            new int[][]{}), "disjoint");
        check(same(s.intervalIntersection(new int[][]{{3, 7}}, new int[][]{{3, 7}}),
            new int[][]{{3, 7}}), "equal");
    }
}
