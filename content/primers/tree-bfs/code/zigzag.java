import java.util.*;

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
// ---- code ----
class Solution {
    public List<List<Integer>> zigzagLevelOrder(TreeNode root) {
        List<List<Integer>> out = new ArrayList<>();
        if (root == null) return out;
        Deque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        boolean leftToRight = true;
        while (!q.isEmpty()) {
            List<Integer> level = new ArrayList<>();
            int size = q.size();
            for (int i = 0; i < size; i++) {
                TreeNode node = q.poll();
                level.add(node.val);
                // queue order never changes, only the output
                if (node.left != null) q.add(node.left);
                if (node.right != null) q.add(node.right);
            }
            if (!leftToRight) Collections.reverse(level);
            out.add(level);
            leftToRight = !leftToRight;
        }
        return out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static TreeNode build(Integer... vals) {
        if (vals.length == 0 || vals[0] == null) return null;
        TreeNode root = new TreeNode(vals[0]);
        Deque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < vals.length) {
            TreeNode node = q.poll();
            if (i < vals.length && vals[i] != null) {
                node.left = new TreeNode(vals[i]);
                q.add(node.left);
            }
            i++;
            if (i < vals.length && vals[i] != null) {
                node.right = new TreeNode(vals[i]);
                q.add(node.right);
            }
            i++;
        }
        return root;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.zigzagLevelOrder(build(3, 9, 20, null, null, 15, 7))
            .equals(List.of(List.of(3), List.of(20, 9), List.of(15, 7))), "example 1");
        check(s.zigzagLevelOrder(build(1)).equals(List.of(List.of(1))), "single");
        check(s.zigzagLevelOrder(null).isEmpty(), "empty");
        // four levels: the direction flips back on the third
        check(s.zigzagLevelOrder(build(1, 2, 3, 4, 5, 6, 7, 8, 9))
            .equals(List.of(List.of(1), List.of(3, 2), List.of(4, 5, 6, 7), List.of(9, 8))), "four levels");
    }
}
