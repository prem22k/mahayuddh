import java.util.*;
// ---- code ----
class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        // indices; values decrease from front to back
        Deque<Integer> dq = new ArrayDeque<>();
        int[] out = new int[nums.length - k + 1];
        for (int i = 0; i < nums.length; i++) {
            int x = nums[i];
            // smaller values can never be a max again
            while (!dq.isEmpty() && nums[dq.peekLast()] <= x) {
                dq.pollLast();
            }
            dq.offerLast(i);
            // the front slid out of the window
            if (dq.peekFirst() <= i - k) dq.pollFirst();
            // the front is this window's max
            if (i >= k - 1) {
                out[i - k + 1] = nums[dq.peekFirst()];
            }
        }
        return out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.maxSlidingWindow(new int[]{1, 3, -1, -3, 5, 3, 6, 7}, 3), new int[]{3, 3, 5, 5, 6, 7}), "example");
        check(Arrays.equals(s.maxSlidingWindow(new int[]{1}, 1), new int[]{1}), "single");
        check(Arrays.equals(s.maxSlidingWindow(new int[]{9, 8, 7, 6}, 2), new int[]{9, 8, 7}), "decreasing");
        check(Arrays.equals(s.maxSlidingWindow(new int[]{4, 4, 4}, 2), new int[]{4, 4}), "ties");
    }
}
