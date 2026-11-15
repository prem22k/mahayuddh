import java.util.*;
// ---- code ----
class Solution {
    public int[] asteroidCollision(int[] asteroids) {
        // survivors so far, left to right
        Deque<Integer> stack = new ArrayDeque<>();
        for (int a : asteroids) {
            boolean alive = true;
            // a moves left into one moving right: they collide
            while (alive && a < 0 && !stack.isEmpty()
                   && stack.peekLast() > 0) {
                if (stack.peekLast() < -a) {
                    // smaller top explodes; a keeps going
                    stack.pollLast();
                    continue;
                }
                if (stack.peekLast() == -a) {
                    // same size: both explode
                    stack.pollLast();
                }
                alive = false;
            }
            if (alive) stack.offerLast(a);
        }
        return stack.stream().mapToInt(x -> x).toArray();
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(Arrays.equals(s.asteroidCollision(new int[]{5, 10, -5}), new int[]{5, 10}), "example 1");
        check(s.asteroidCollision(new int[]{8, -8}).length == 0, "equal sizes");
        check(Arrays.equals(s.asteroidCollision(new int[]{10, 2, -5}), new int[]{10}), "chain");
        check(s.asteroidCollision(new int[]{}).length == 0, "empty");
        check(Arrays.equals(s.asteroidCollision(new int[]{5}), new int[]{5}), "single");
        check(Arrays.equals(s.asteroidCollision(new int[]{-2, -1, 1, 2}), new int[]{-2, -1, 1, 2}), "apart");
        check(Arrays.equals(s.asteroidCollision(new int[]{1, 2, 3, -10, 4}), new int[]{-10, 4}), "big left-mover");
        check(Arrays.equals(s.asteroidCollision(new int[]{1, -2, -2, -2}), new int[]{-2, -2, -2}), "survivor then more");
    }
}
