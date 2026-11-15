import java.util.*;
// ---- code ----
class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> present = new HashSet<>();
        for (int x : nums) present.add(x);
        int best = 0;
        for (int x : present) {
            // only count from the first number of a run
            if (present.contains(x - 1)) continue;
            int length = 1;
            while (present.contains(x + length)) length++;
            best = Math.max(best, length);
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.longestConsecutive(new int[]{100, 4, 200, 1, 3, 2}) == 4, "example");
        check(s.longestConsecutive(new int[]{0, 3, 7, 2, 5, 8, 4, 6, 0, 1}) == 9, "long run");
        check(s.longestConsecutive(new int[]{}) == 0, "empty");
        check(s.longestConsecutive(new int[]{5}) == 1, "single");
        check(s.longestConsecutive(new int[]{1, 2, 0, 1}) == 3, "duplicates");
        check(s.longestConsecutive(new int[]{-1, 0, 1, 10}) == 3, "negatives");
    }
}
