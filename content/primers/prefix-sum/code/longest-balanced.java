import java.util.*;
// ---- code ----
class Solution {
    public int findMaxLength(int[] nums) {
        // count 0 as -1, so a balanced stretch sums to 0.
        // prefix -> the FIRST index where it appeared
        Map<Integer, Integer> first = new HashMap<>();
        first.put(0, -1);
        int prefix = 0, best = 0;
        for (int i = 0; i < nums.length; i++) {
            prefix += nums[i] == 1 ? 1 : -1;
            if (first.containsKey(prefix)) {
                // same prefix twice: the part between sums to 0
                best = Math.max(best, i - first.get(prefix));
            } else {
                // keep the first index: it gives the longest
                first.put(prefix, i);
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
        check(s.findMaxLength(new int[]{0, 1}) == 2, "example 1");
        check(s.findMaxLength(new int[]{0, 1, 0}) == 2, "example 2");
        check(s.findMaxLength(new int[]{0, 0, 1, 0, 0, 0, 1, 1}) == 6, "longer");
        check(s.findMaxLength(new int[]{}) == 0, "empty");
        check(s.findMaxLength(new int[]{1}) == 0, "single");
        check(s.findMaxLength(new int[]{1, 1, 1, 0}) == 2, "mostly ones");
        check(s.findMaxLength(new int[]{0, 1, 1, 0, 1, 0}) == 6, "keep first index");
    }
}
