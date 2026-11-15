import java.util.*;
// ---- code ----
class Solution {
    public int[] singleNumber(int[] nums) {
        // pairs cancel, so both = a ^ b. Since a != b, both
        // has a 1 bit somewhere a and b differ
        int both = 0;
        for (int x : nums) both ^= x;
        // x & -x keeps only the lowest 1 bit of x
        int low = both & -both;
        int a = 0;
        for (int x : nums) {
            // split on that bit: a and b go to different sides,
            // and the two copies of a pair go to the same side
            if ((x & low) != 0) a ^= x;
        }
        return new int[]{a, both ^ a};
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    static int[] sorted(int[] xs) {
        int[] c = xs.clone();
        Arrays.sort(c);
        return c;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(sorted(s.singleNumber(new int[]{1, 2, 1, 3, 2, 5})), new int[]{3, 5}), "example 1");
        check(Arrays.equals(sorted(s.singleNumber(new int[]{-1, 0})), new int[]{-1, 0}), "example 2");
        check(Arrays.equals(sorted(s.singleNumber(new int[]{0, 1})), new int[]{0, 1}), "example 3");
        // they differ only in a higher bit: 2 = 010, 6 = 110
        check(Arrays.equals(sorted(s.singleNumber(new int[]{2, 6, 4, 4})), new int[]{2, 6}), "higher bit");
        // the lowest differing bit is the sign bit
        int lo = Integer.MIN_VALUE, hi = Integer.MAX_VALUE;
        check(Arrays.equals(sorted(s.singleNumber(new int[]{lo, 0})), new int[]{lo, 0}), "sign bit");
        check(Arrays.equals(sorted(s.singleNumber(new int[]{lo, 7, hi, 7})), new int[]{lo, hi}), "extremes");
    }
}
