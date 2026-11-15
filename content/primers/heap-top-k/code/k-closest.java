import java.util.*;
// ---- code ----
class Solution {
    public int[][] kClosest(int[][] points, int k) {
        // max-heap of (distance, index): the k closest so far
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> Integer.compare(b[0], a[0]));
        for (int i = 0; i < points.length; i++) {
            int x = points[i][0], y = points[i][1];
            int d = x * x + y * y;
            heap.offer(new int[]{d, i});
            // one too many: drop the farthest
            if (heap.size() > k) heap.poll();
        }
        int[][] out = new int[heap.size()][];
        for (int j = 0; j < out.length; j++) {
            out[j] = points[heap.poll()[1]];
        }
        return out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static int[][] sorted(int[][] v) {
        int[][] c = v.clone();
        Arrays.sort(c, (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));
        return c;
    }

    static boolean same(int[][] got, int[][] want) { return Arrays.deepEquals(sorted(got), sorted(want)); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(same(s.kClosest(new int[][]{{1, 3}, {-2, 2}}, 1), new int[][]{{-2, 2}}), "example 1");
        check(same(s.kClosest(new int[][]{{3, 3}, {5, -1}, {-2, 4}}, 2),
            new int[][]{{-2, 4}, {3, 3}}), "example 2");
        check(same(s.kClosest(new int[][]{{0, 0}}, 1), new int[][]{{0, 0}}), "single");
        // k = n returns everything
        check(same(s.kClosest(new int[][]{{1, 0}, {0, 2}, {3, 0}}, 3),
            new int[][]{{0, 2}, {1, 0}, {3, 0}}), "k = n");
        // the far point comes first and must be dropped later
        check(same(s.kClosest(new int[][]{{10, 10}, {1, 1}, {0, 1}}, 2),
            new int[][]{{0, 1}, {1, 1}}), "drop far");
    }
}
