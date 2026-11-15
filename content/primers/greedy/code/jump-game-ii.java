import java.util.*;
// ---- code ----
class Solution {
    public int jump(int[] nums) {
        int jumps = 0;
        // this many jumps reach up to index end
        int end = 0;
        // one more jump could reach up to farthest
        int farthest = 0;
        for (int i = 0; i + 1 < nums.length; i++) {
            farthest = Math.max(farthest, i + nums[i]);
            // at the edge of this jump's reach: take another
            if (i == end) {
                jumps++;
                end = farthest;
            }
        }
        return jumps;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.jump(new int[]{2, 3, 1, 1, 4}) == 2, "example 1");
        check(s.jump(new int[]{2, 3, 0, 1, 4}) == 2, "example 2");
        check(s.jump(new int[]{0}) == 0, "already there");
        check(s.jump(new int[]{1, 1, 1, 1}) == 3, "ones");
        // one big jump covers everything
        check(s.jump(new int[]{9, 1, 1, 1, 1}) == 1, "one jump");
        // jumping as far as possible first is the trap
        check(s.jump(new int[]{3, 1, 4, 1, 1, 1, 1}) == 2, "farthest landing trap");
    }
}
