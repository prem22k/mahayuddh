import java.util.*;
// ---- code ----
class Solution {
    public int subarraysDivByK(int[] nums, int k) {
        // prefix remainder -> how many times it has appeared.
        // equal remainders differ by a multiple of k
        Map<Integer, Integer> seen = new HashMap<>();
        seen.put(0, 1);
        int rem = 0, count = 0;
        for (int x : nums) {
            // keep the remainder in 0..k-1, even for negatives
            rem = ((rem + x) % k + k) % k;
            count += seen.getOrDefault(rem, 0);
            seen.merge(rem, 1, Integer::sum);
        }
        return count;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.subarraysDivByK(new int[]{4, 5, 0, -2, -3, 1}, 5) == 7, "example");
        check(s.subarraysDivByK(new int[]{5}, 9) == 0, "single miss");
        check(s.subarraysDivByK(new int[]{5}, 5) == 1, "single match");
        check(s.subarraysDivByK(new int[]{}, 3) == 0, "empty");
        check(s.subarraysDivByK(new int[]{-1, 2, 9}, 2) == 2, "negative remainder");
        check(s.subarraysDivByK(new int[]{-1, -1, 2}, 2) == 3, "negatives");
    }
}
