import java.util.*;
// ---- code ----
class Solution {
    public List<List<Integer>> combinationSum(int[] candidates,
                                              int target) {
        // sorted, so one number too big means the rest are too
        int[] nums = candidates.clone();
        Arrays.sort(nums);
        List<List<Integer>> out = new ArrayList<>();
        backtrack(nums, 0, target, new ArrayList<>(), out);
        return out;
    }

    private void backtrack(int[] nums, int start, int remain,
                           List<Integer> path,
                           List<List<Integer>> out) {
        if (remain == 0) {
            out.add(new ArrayList<>(path));
            return;
        }
        for (int i = start; i < nums.length; i++) {
            // prune: this branch and every later one overshoot
            if (nums[i] > remain) break;
            path.add(nums[i]);
            // i, not i + 1: the same number can be used again
            backtrack(nums, i, remain - nums[i], path, out);
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
        check(sorted(s.combinationSum(new int[]{2, 3, 6, 7}, 7))
            .equals(List.of(List.of(2, 2, 3), List.of(7))), "example 1");
        check(sorted(s.combinationSum(new int[]{2, 3, 5}, 8))
            .equals(List.of(List.of(2, 2, 2, 2), List.of(2, 3, 3), List.of(3, 5))), "example 2");
        check(s.combinationSum(new int[]{2}, 1).isEmpty(), "none");
        check(s.combinationSum(new int[]{1}, 2).equals(List.of(List.of(1, 1))), "reuse");
        // unsorted input: the early break only works after sorting
        check(sorted(s.combinationSum(new int[]{7, 3, 2}, 7))
            .equals(List.of(List.of(2, 2, 3), List.of(7))), "unsorted");
        check(sorted(s.combinationSum(new int[]{8, 4, 2}, 8))
            .equals(List.of(List.of(2, 2, 2, 2), List.of(2, 2, 4), List.of(4, 4), List.of(8))), "unsorted 2");
    }
}
