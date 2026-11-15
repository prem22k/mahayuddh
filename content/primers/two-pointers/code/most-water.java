import java.util.*;
// ---- code ----
class Solution {
    public int maxArea(int[] height) {
        int left = 0, right = height.length - 1;
        int best = 0;
        while (left < right) {
            int h = Math.min(height[left], height[right]);
            best = Math.max(best, h * (right - left));
            // the shorter wall can't do better with any closer
            // partner, so it's done: move it inward
            if (height[left] < height[right]) {
                left++;
            } else {
                right--;
            }
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.maxArea(new int[]{1, 8, 6, 2, 5, 4, 8, 3, 7}) == 49, "example");
        check(s.maxArea(new int[]{1, 1}) == 1, "two walls");
        check(s.maxArea(new int[]{4, 3, 2, 1, 4}) == 16, "ends");
        check(s.maxArea(new int[]{1, 2, 1}) == 2, "small");
        check(s.maxArea(new int[]{5}) == 0, "single");
        check(s.maxArea(new int[]{}) == 0, "empty");
        check(s.maxArea(new int[]{1, 2, 4, 3}) == 4, "middle pair");
        check(s.maxArea(new int[]{2, 3, 4, 5, 18, 17, 6}) == 17, "tall neighbours");
    }
}
