import java.util.*;
// ---- code ----
class Solution {
    public int[] dailyTemperatures(int[] temps) {
        int[] ans = new int[temps.length];
        // days still waiting for a warmer one; their temps
        // never rise from the bottom of the stack to the top
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < temps.length; i++) {
            // today answers every colder day on top
            while (!stack.isEmpty()
                   && temps[stack.peek()] < temps[i]) {
                int j = stack.pop();
                ans[j] = i - j;
            }
            stack.push(i);
        }
        // days left on the stack never warm up: they stay 0
        return ans;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.dailyTemperatures(new int[]{73, 74, 75, 71, 69, 72, 76, 73}), new int[]{1, 1, 4, 2, 1, 1, 0, 0}), "walkthrough");
        check(Arrays.equals(s.dailyTemperatures(new int[]{30, 40, 50, 60}), new int[]{1, 1, 1, 0}), "rising");
        check(Arrays.equals(s.dailyTemperatures(new int[]{30, 60, 90}), new int[]{1, 1, 0}), "short");
        check(s.dailyTemperatures(new int[]{}).length == 0, "empty");
        check(Arrays.equals(s.dailyTemperatures(new int[]{50}), new int[]{0}), "single");
        check(Arrays.equals(s.dailyTemperatures(new int[]{70, 70, 71}), new int[]{2, 1, 0}), "ties");
        check(Arrays.equals(s.dailyTemperatures(new int[]{90, 80, 70}), new int[]{0, 0, 0}), "falling");
    }
}
