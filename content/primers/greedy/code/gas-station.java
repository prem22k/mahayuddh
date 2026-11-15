import java.util.*;
// ---- code ----
class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int total = 0, tank = 0, start = 0;
        for (int i = 0; i < gas.length; i++) {
            total += gas[i] - cost[i];
            tank += gas[i] - cost[i];
            // stuck before i + 1: no start from start..i works
            if (tank < 0) {
                start = i + 1;
                tank = 0;
            }
        }
        // enough gas overall means the last start survives
        return total >= 0 ? start : -1;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.canCompleteCircuit(new int[]{1, 2, 3, 4, 5}, new int[]{3, 4, 5, 1, 2}) == 3, "example 1");
        check(s.canCompleteCircuit(new int[]{2, 3, 4}, new int[]{3, 4, 3}) == -1, "example 2");
        check(s.canCompleteCircuit(new int[]{5}, new int[]{4}) == 0, "single ok");
        check(s.canCompleteCircuit(new int[]{4}, new int[]{5}) == -1, "single short");
        // exactly enough gas in total
        check(s.canCompleteCircuit(new int[]{1, 1, 3}, new int[]{2, 2, 1}) == 2, "exact");
        // a tank of exactly zero is not stuck: keep the start
        check(s.canCompleteCircuit(new int[]{2, 3, 1}, new int[]{2, 1, 3}) == 0, "zero tank");
        check(s.canCompleteCircuit(new int[]{3, 1, 1}, new int[]{1, 2, 2}) == 0, "start 0");
    }
}
