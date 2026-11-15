import java.util.*;
// ---- code ----
class Solution {
    public int[] twoSum(int[] numbers, int target) {
        int left = 0, right = numbers.length - 1;
        while (left < right) {
            int s = numbers[left] + numbers[right];
            if (s == target) {
                // the problem wants 1-based indices
                return new int[]{left + 1, right + 1};
            }
            if (s < target) {
                // too small even with the largest partner,
                // so numbers[left] fits no answer: drop it
                left++;
            } else {
                // too big even with the smallest partner,
                // so numbers[right] fits no answer: drop it
                right--;
            }
        }
        return new int[0];
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.twoSum(new int[]{1, 3, 4, 6, 8, 11}, 10), new int[]{3, 4}), "walkthrough");
        check(Arrays.equals(s.twoSum(new int[]{2, 7, 11, 15}, 9), new int[]{1, 2}), "example");
        check(Arrays.equals(s.twoSum(new int[]{2, 3, 4}, 6), new int[]{1, 3}), "ends");
        check(Arrays.equals(s.twoSum(new int[]{-1, 0}, -1), new int[]{1, 2}), "negatives");
        check(s.twoSum(new int[]{5}, 10).length == 0, "single");
        check(s.twoSum(new int[]{}, 0).length == 0, "empty");
        check(Arrays.equals(s.twoSum(new int[]{1, 2, 3, 4, 4, 9, 56, 90}, 8), new int[]{4, 5}), "equal values");
    }
}
