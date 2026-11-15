import java.util.*;
// ---- code ----
class Solution {
    public int largestRectangleArea(int[] heights) {
        int n = heights.length;
        // bar indices; heights rise from bottom to top
        Deque<Integer> stack = new ArrayDeque<>();
        int best = 0;
        // one extra bar of height 0 at i = n empties the stack
        for (int i = 0; i <= n; i++) {
            int h = i < n ? heights[i] : 0;
            while (!stack.isEmpty()
                   && heights[stack.peek()] >= h) {
                // the popped bar can't stretch right past i-1,
                // nor left past the bar now on top
                int top = heights[stack.pop()];
                int left = stack.isEmpty() ? -1 : stack.peek();
                best = Math.max(best, top * (i - left - 1));
            }
            stack.push(i);
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.largestRectangleArea(new int[]{2, 1, 5, 6, 2, 3}) == 10, "example");
        check(s.largestRectangleArea(new int[]{2, 4}) == 4, "two bars");
        check(s.largestRectangleArea(new int[]{}) == 0, "empty");
        check(s.largestRectangleArea(new int[]{7}) == 7, "single");
        check(s.largestRectangleArea(new int[]{2, 2, 2}) == 6, "equal heights");
        check(s.largestRectangleArea(new int[]{6, 2, 5, 4, 5, 1, 6}) == 12, "middle block");
        check(s.largestRectangleArea(new int[]{1, 2, 3, 4, 5}) == 9, "rising");
    }
}
