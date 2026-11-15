import java.util.*;
// ---- code ----
class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> out = new ArrayList<>();
        int n = nums.length;
        for (int i = 0; i + 2 < n; i++) {
            // same first value again would repeat triplets
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            // two-sum on the rest, looking for -a
            int a = nums[i];
            int lo = i + 1, hi = n - 1;
            while (lo < hi) {
                int s = a + nums[lo] + nums[hi];
                if (s < 0) { lo++; continue; }
                if (s > 0) { hi--; continue; }
                out.add(List.of(a, nums[lo], nums[hi]));
                lo++;
                hi--;
                // skip copies of the value just used
                while (lo < hi && nums[lo] == nums[lo - 1]) {
                    lo++;
                }
            }
        }
        return out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.threeSum(new int[]{-1, 0, 1, 2, -1, -4}).equals(
            List.of(List.of(-1, -1, 2), List.of(-1, 0, 1))), "example");
        check(s.threeSum(new int[]{0, 1, 1}).isEmpty(), "none");
        check(s.threeSum(new int[]{0, 0, 0}).equals(List.of(List.of(0, 0, 0))), "zeros");
        check(s.threeSum(new int[]{}).isEmpty(), "empty");
        check(s.threeSum(new int[]{1}).isEmpty(), "single");
        check(s.threeSum(new int[]{0, 0, 0, 0}).equals(List.of(List.of(0, 0, 0))), "four zeros");
        check(s.threeSum(new int[]{-2, 0, 0, 2, 2}).equals(List.of(List.of(-2, 0, 2))), "dup pair");
        check(s.threeSum(new int[]{-2, -2, 0, 0, 2, 2}).equals(List.of(List.of(-2, 0, 2))), "dup first");
    }
}
