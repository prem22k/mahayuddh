import java.util.*;
// ---- code ----
class Solution {
    public int removeDuplicates(int[] nums) {
        // nums[0..write-1] holds the values kept so far
        int write = 0;
        for (int read = 0; read < nums.length; read++) {
            // sorted, so a new value differs from the last kept
            if (write == 0 || nums[read] != nums[write - 1]) {
                nums[write] = nums[read];
                write++;
            }
        }
        return write;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        int[] a = {1, 1, 2};
        check(s.removeDuplicates(a) == 2 && a[0] == 1 && a[1] == 2, "example 1");
        a = new int[]{0, 0, 1, 1, 1, 2, 2, 3, 3, 4};
        check(s.removeDuplicates(a) == 5 && Arrays.equals(Arrays.copyOf(a, 5), new int[]{0, 1, 2, 3, 4}), "example 2");
        check(s.removeDuplicates(new int[]{}) == 0, "empty");
        a = new int[]{7};
        check(s.removeDuplicates(a) == 1 && a[0] == 7, "single");
        a = new int[]{-3, -3, -3};
        check(s.removeDuplicates(a) == 1 && a[0] == -3, "all same");
        a = new int[]{1, 2, 3};
        check(s.removeDuplicates(a) == 3 && Arrays.equals(a, new int[]{1, 2, 3}), "no duplicates");
    }
}
