import java.util.*;
// ---- code ----
class Solution {
    public int findKthLargest(int[] nums, int k) {
        // min-heap of the k largest values seen so far
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int x : nums) {
            heap.offer(x);
            // one too many: the smallest can't be in the top k
            if (heap.size() > k) heap.poll();
        }
        // the smallest of the k largest is the kth largest
        return heap.peek();
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.findKthLargest(new int[]{3, 2, 1, 5, 6, 4}, 2) == 5, "example 1");
        check(s.findKthLargest(new int[]{3, 2, 3, 1, 2, 4, 5, 5, 6}, 4) == 4, "example 2");
        check(s.findKthLargest(new int[]{7}, 1) == 7, "single");
        // k = n is the minimum; k = 1 is the maximum
        check(s.findKthLargest(new int[]{4, -1, 9, 0}, 4) == -1, "k = n");
        check(s.findKthLargest(new int[]{4, -1, 9, 0}, 1) == 9, "k = 1");
        // duplicates count separately
        check(s.findKthLargest(new int[]{5, 5, 5, 1}, 3) == 5, "duplicates");
    }
}
