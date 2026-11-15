import java.util.*;
// ---- code ----
class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        // how often each value appears
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : nums) count.merge(x, 1, Integer::sum);
        // min-heap of (frequency, value), at most k entries
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> a[0] != b[0]
                ? Integer.compare(a[0], b[0])
                : Integer.compare(a[1], b[1]));
        for (Map.Entry<Integer, Integer> e : count.entrySet()) {
            heap.offer(new int[]{e.getValue(), e.getKey()});
            // drop the least frequent of the k + 1
            if (heap.size() > k) heap.poll();
        }
        int[] out = new int[heap.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = heap.poll()[1];
        }
        return out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static int[] sorted(int[] v) {
        int[] c = v.clone();
        Arrays.sort(c);
        return c;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(sorted(s.topKFrequent(new int[]{1, 1, 1, 2, 2, 3}, 2)), new int[]{1, 2}), "example 1");
        check(Arrays.equals(s.topKFrequent(new int[]{1}, 1), new int[]{1}), "single");
        // every value once except 4: k = 1 must pick 4
        check(Arrays.equals(s.topKFrequent(new int[]{3, 4, 4, 1, 2}, 1), new int[]{4}), "one winner");
        // k equals the number of distinct values
        check(Arrays.equals(sorted(s.topKFrequent(new int[]{5, -1, 5, -1, 7}, 3)), new int[]{-1, 5, 7}), "all");
        // frequencies run against value order
        check(Arrays.equals(sorted(s.topKFrequent(new int[]{9, 9, 9, 1, 1, 2, 3}, 2)), new int[]{1, 9}), "order");
    }
}
