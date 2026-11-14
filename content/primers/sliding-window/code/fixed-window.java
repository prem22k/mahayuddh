// ---- code ----
class Solution {
    public double findMaxAverage(int[] nums, int k) {
        // the first window, built once
        long window = 0;
        for (int i = 0; i < k; i++) window += nums[i];
        long best = window;
        for (int right = k; right < nums.length; right++) {
            // one in, one out
            window += nums[right] - nums[right - k];
            best = Math.max(best, window);
        }
        return (double) best / k;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Math.abs(s.findMaxAverage(new int[]{1, 12, -5, -6, 50, 3}, 4) - 12.75) < 1e-9, "example");
        check(s.findMaxAverage(new int[]{5}, 1) == 5, "single");
        check(s.findMaxAverage(new int[]{-1, -2, -3}, 2) == -1.5, "negatives");
    }
}
