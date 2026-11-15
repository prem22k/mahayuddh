import java.util.*;
// ---- code ----
class Solution {
    public int[] nextGreaterElements(int[] nums) {
        int n = nums.length;
        int[] ans = new int[n];
        Arrays.fill(ans, -1);
        // indices still waiting for a greater value
        Deque<Integer> stack = new ArrayDeque<>();
        // go round twice so the end can see the start
        for (int i = 0; i < 2 * n; i++) {
            int x = nums[i % n];
            while (!stack.isEmpty() && nums[stack.peek()] < x) {
                ans[stack.pop()] = x;
            }
            // push each index once, on the first lap only
            if (i < n) stack.push(i);
        }
        return ans;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.nextGreaterElements(new int[]{1, 2, 1}), new int[]{2, -1, 2}), "example 1");
        check(Arrays.equals(s.nextGreaterElements(new int[]{1, 2, 3, 4, 3}), new int[]{2, 3, 4, -1, 4}), "example 2");
        check(s.nextGreaterElements(new int[]{}).length == 0, "empty");
        check(Arrays.equals(s.nextGreaterElements(new int[]{5}), new int[]{-1}), "single");
        check(Arrays.equals(s.nextGreaterElements(new int[]{3, 3, 3}), new int[]{-1, -1, -1}), "all equal");
        check(Arrays.equals(s.nextGreaterElements(new int[]{5, 4, 3, 2, 1}), new int[]{-1, 5, 5, 5, 5}), "second lap");
    }
}
