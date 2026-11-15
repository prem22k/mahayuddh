// ---- code ----
class Solution {
    public int singleNumber(int[] nums) {
        // x ^ x = 0 and x ^ 0 = x, in any order, so every pair
        // cancels and only the unpaired number is left
        int acc = 0;
        for (int x : nums) acc ^= x;
        return acc;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.singleNumber(new int[]{4, 1, 2, 1, 2}) == 4, "walkthrough");
        check(s.singleNumber(new int[]{2, 2, 1}) == 1, "example 1");
        check(s.singleNumber(new int[]{1}) == 1, "one");
        // negatives cancel the same way
        check(s.singleNumber(new int[]{-3, 7, 7}) == -3, "negative");
        check(s.singleNumber(new int[]{5, -3, 5}) == -3, "negative middle");
        // the answer can be 0
        check(s.singleNumber(new int[]{0, 5, 5}) == 0, "zero");
        // pairs don't have to be next to each other
        check(s.singleNumber(new int[]{9, 1, 9, 3, 1, 8, 3}) == 8, "spread pairs");
    }
}
