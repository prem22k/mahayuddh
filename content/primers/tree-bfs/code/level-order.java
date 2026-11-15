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
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> out = new ArrayList<>();
        if (root == null) return out;
        Deque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        while (!q.isEmpty()) {
            List<Integer> level = new ArrayList<>();
            // everything in the queue right now is one level
            int size = q.size();
            for (int i = 0; i < size; i++) {
                TreeNode node = q.poll();
                level.add(node.val);
                // children wait behind the rest of this level
                if (node.left != null) q.add(node.left);
                if (node.right != null) q.add(node.right);
            }
            out.add(level);
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
        check(s.levelOrder(build(3, 9, 20, null, null, 15, 7))
            .equals(List.of(List.of(3), List.of(9, 20), List.of(15, 7))), "example 1");
        check(s.levelOrder(build(1)).equals(List.of(List.of(1))), "single");
        check(s.levelOrder(null).isEmpty(), "empty");
        // a gap in the middle level must not shift the next one
        check(s.levelOrder(build(1, 2, 3, null, 4, 5, null, 6))
            .equals(List.of(List.of(1), List.of(2, 3), List.of(4, 5), List.of(6))), "gaps");
        // a chain: one node per level
        check(s.levelOrder(build(1, null, 2, null, 3))
            .equals(List.of(List.of(1), List.of(2), List.of(3))), "chain");
    }
}
