import java.util.*;
// ---- code ----
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> out = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), out);
        return out;
    }

    private void backtrack(int[] nums, int start,
                           List<Integer> path,
                           List<List<Integer>> out) {
        // every node of the tree is a subset: record a copy
        out.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            // choose nums[i]
            path.add(nums[i]);
            // only later indexes, so each set appears once
            backtrack(nums, i + 1, path, out);
            // un-choose: the next i starts from the same path
            path.remove(path.size() - 1);
        }
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    static List<List<Integer>> sorted(List<List<Integer>> xs) {
        List<List<Integer>> c = new ArrayList<>(xs);
        c.sort((a, b) -> {
            for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
                int d = Integer.compare(a.get(i), b.get(i));
                if (d != 0) return d;
            }
            return Integer.compare(a.size(), b.size());
        });
        return c;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        // the walkthrough's order, exactly as the recursion records it
        List<List<Integer>> walk = List.of(List.of(), List.of(1), List.of(1, 2), List.of(1, 2, 3),
            List.of(1, 3), List.of(2), List.of(2, 3), List.of(3));
        check(s.subsets(new int[]{1, 2, 3}).equals(walk), "walkthrough order");
        check(sorted(s.subsets(new int[]{0})).equals(sorted(List.of(List.of(), List.of(0)))), "one");
        check(s.subsets(new int[]{}).equals(List.of(List.of())), "empty");
        // 2^n subsets, all different
        int[] nums = new int[10];
        for (int i = 0; i < 10; i++) nums[i] = i;
        List<List<Integer>> ten = s.subsets(nums);
        check(ten.size() == 1024, "count");
        check(new HashSet<>(ten).size() == 1024, "distinct");
        // negatives and unsorted input keep their input order
        check(sorted(s.subsets(new int[]{3, -1})).equals(
            sorted(List.of(List.of(), List.of(3), List.of(-1), List.of(3, -1)))), "negatives");
    }
}
