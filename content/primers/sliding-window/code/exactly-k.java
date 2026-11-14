import java.util.*;
// ---- code ----
class Solution {
    public int subarraysWithKDistinct(int[] nums, int k) {
        // exactly k = at most k − at most k−1
        return atMost(nums, k) - atMost(nums, k - 1);
    }

    private int atMost(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        int left = 0, total = 0;
        for (int right = 0; right < nums.length; right++) {
            count.merge(nums[right], 1, Integer::sum);
            // too many distinct: shrink
            while (count.size() > k) {
                int x = nums[left];
                if (count.merge(x, -1, Integer::sum) == 0) {
                    count.remove(x);
                }
                left++;
            }
            // every window that ends at right
            total += right - left + 1;
        }
        return total;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.subarraysWithKDistinct(new int[]{1, 2, 1, 2, 3}, 2) == 7, "example 1");
        check(s.subarraysWithKDistinct(new int[]{1, 2, 1, 3, 4}, 3) == 3, "example 2");
        check(s.subarraysWithKDistinct(new int[]{1}, 1) == 1, "single");
    }
}
