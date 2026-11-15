import java.util.*;
// ---- code ----
class Solution {
    public int twoCitySchedCost(int[][] costs) {
        // most money saved by flying to A, relative to B, first
        Arrays.sort(costs, (x, y) ->
            Integer.compare(x[0] - x[1], y[0] - y[1]));
        int n = costs.length / 2;
        int total = 0;
        for (int i = 0; i < costs.length; i++) {
            // first half flies to A, second half to B
            total += i < n ? costs[i][0] : costs[i][1];
        }
        return total;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.twoCitySchedCost(new int[][]{{10, 20}, {30, 200}, {400, 50}, {30, 20}}) == 110, "example 1");
        check(s.twoCitySchedCost(new int[][]{{259, 770}, {448, 54}, {926, 667}, {184, 139}, {840, 118}, {577, 469}}) == 1859, "example 2");
        check(s.twoCitySchedCost(new int[][]{{5, 9}, {2, 1}}) == 6, "two people");
        // A is cheaper for everyone, but only half may go
        check(s.twoCitySchedCost(new int[][]{{1, 100}, {2, 50}, {3, 10}, {4, 5}}) == 1 + 2 + 10 + 5, "half each");
    }
}
