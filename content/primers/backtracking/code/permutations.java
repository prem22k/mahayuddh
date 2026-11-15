import java.util.*;
// ---- code ----
class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> out = new ArrayList<>();
        boolean[] used = new boolean[nums.length];
        backtrack(nums, used, new ArrayList<>(), out);
        return out;
    }

    private void backtrack(int[] nums, boolean[] used,
                           List<Integer> path,
                           List<List<Integer>> out) {
        // a full-length path is one permutation
        if (path.size() == nums.length) {
            out.add(new ArrayList<>(path));
            return;
        }
        // any unused element can go next, so start from 0
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            path.add(nums[i]);
            backtrack(nums, used, path, out);
            // undo both changes before trying the next i
            path.remove(path.size() - 1);
            used[i] = false;
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
        List<List<Integer>> want = List.of(List.of(1, 2, 3), List.of(1, 3, 2), List.of(2, 1, 3),
            List.of(2, 3, 1), List.of(3, 1, 2), List.of(3, 2, 1));
        check(sorted(s.permute(new int[]{1, 2, 3})).equals(want), "example 1");
        check(sorted(s.permute(new int[]{0, 1})).equals(List.of(List.of(0, 1), List.of(1, 0))), "example 2");
        check(s.permute(new int[]{1}).equals(List.of(List.of(1))), "one");
        // n! results, all different, each a rearrangement of nums
        List<List<Integer>> six = s.permute(new int[]{5, -1, 0, 7, 2, 9});
        check(six.size() == 720, "count");
        check(new HashSet<>(six).size() == 720, "distinct");
        for (List<Integer> p : six) {
            List<Integer> q = new ArrayList<>(p);
            Collections.sort(q);
            check(q.equals(List.of(-1, 0, 2, 5, 7, 9)), "rearrangement");
        }
    }
}
