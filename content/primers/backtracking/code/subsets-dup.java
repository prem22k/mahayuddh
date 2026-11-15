import java.util.*;
// ---- code ----
class Solution {
    public List<List<Integer>> subsetsWithDup(int[] input) {
        // sorting puts equal values next to each other
        int[] nums = input.clone();
        Arrays.sort(nums);
        List<List<Integer>> out = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), out);
        return out;
    }

    private void backtrack(int[] nums, int start,
                           List<Integer> path,
                           List<List<Integer>> out) {
        out.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            // same value as the last choice at this depth:
            // its whole subtree was already built, so skip it
            if (i > start && nums[i] == nums[i - 1]) continue;
            path.add(nums[i]);
            backtrack(nums, i + 1, path, out);
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
        check(sorted(s.subsetsWithDup(new int[]{1, 2, 2})).equals(sorted(List.of(
            List.of(), List.of(1), List.of(1, 2), List.of(1, 2, 2), List.of(2), List.of(2, 2)))), "example 1");
        check(sorted(s.subsetsWithDup(new int[]{0})).equals(sorted(List.of(List.of(), List.of(0)))), "example 2");
        // all equal: one subset per count, 0 to 3
        check(sorted(s.subsetsWithDup(new int[]{5, 5, 5})).equals(sorted(List.of(
            List.of(), List.of(5), List.of(5, 5), List.of(5, 5, 5)))), "all equal");
        // unsorted input: the skip only sees duplicates after sorting
        List<List<Integer>> got = s.subsetsWithDup(new int[]{4, 4, 4, 1, 4});
        check(got.size() == 10, "count");
        check(new HashSet<>(got).size() == 10, "distinct");
        check(sorted(got).equals(sorted(List.of(List.of(), List.of(1), List.of(1, 4), List.of(1, 4, 4),
            List.of(1, 4, 4, 4), List.of(1, 4, 4, 4, 4), List.of(4), List.of(4, 4), List.of(4, 4, 4),
            List.of(4, 4, 4, 4)))), "unsorted");
    }
}
