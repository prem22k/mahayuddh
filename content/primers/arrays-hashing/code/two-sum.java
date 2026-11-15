import java.util.*;
// ---- code ----
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // value -> index, for everything left of i
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            // 1. is the partner already stored?
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[]{seen.get(need), i};
            }
            // 2. no: store this value for later numbers
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.twoSum(new int[]{4, 6, 1, 9, 3, 5}, 8), new int[]{4, 5}), "walkthrough");
        check(Arrays.equals(s.twoSum(new int[]{2, 7, 11, 15}, 9), new int[]{0, 1}), "example");
        check(Arrays.equals(s.twoSum(new int[]{3, 3}, 6), new int[]{0, 1}), "equal pair");
        check(Arrays.equals(s.twoSum(new int[]{3, 2, 4}, 6), new int[]{1, 2}), "not itself");
        check(Arrays.equals(s.twoSum(new int[]{-1, -2, -3, -4, -5}, -8), new int[]{2, 4}), "negatives");
        check(s.twoSum(new int[]{5}, 10).length == 0, "single");
        check(s.twoSum(new int[]{}, 1).length == 0, "empty");
    }
}
