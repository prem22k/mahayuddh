import java.util.*;
// ---- code ----
class Solution {
    public int subarraySum(int[] nums, int k) {
        // prefix sum -> how many times it has appeared;
        // 0 is the empty prefix, before index 0
        Map<Integer, Integer> seen = new HashMap<>();
        seen.put(0, 1);
        int prefix = 0, count = 0;
        for (int x : nums) {
            prefix += x;
            // 1. earlier prefixes == prefix - k: one match each
            count += seen.getOrDefault(prefix - k, 0);
            // 2. then record this prefix for later indices
            seen.merge(prefix, 1, Integer::sum);
        }
        return count;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.subarraySum(new int[]{1, 2, 3, -3, 3}, 3) == 5, "walkthrough");
        check(s.subarraySum(new int[]{1, 1, 1}, 2) == 2, "example 1");
        check(s.subarraySum(new int[]{1, 2, 3}, 3) == 2, "example 2");
        check(s.subarraySum(new int[]{}, 0) == 0, "empty");
        check(s.subarraySum(new int[]{5}, 5) == 1, "single match");
        check(s.subarraySum(new int[]{5}, 4) == 0, "single miss");
        check(s.subarraySum(new int[]{0, 0, 0}, 0) == 6, "k = 0");
        check(s.subarraySum(new int[]{1, -1, 0}, 0) == 3, "negatives, k = 0");
    }
}
