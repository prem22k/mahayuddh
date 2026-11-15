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
    public int minDepth(TreeNode root) {
        if (root == null) return 0;
        Deque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        int depth = 1;
        while (!q.isEmpty()) {
            int size = q.size();
            for (int i = 0; i < size; i++) {
                TreeNode node = q.poll();
                // levels come in order: first leaf is closest
                if (node.left == null && node.right == null) {
                    return depth;
                }
                if (node.left != null) q.add(node.left);
                if (node.right != null) q.add(node.right);
            }
            depth++;
        }
        return depth;
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
        check(s.minDepth(build(3, 9, 20, null, null, 15, 7)) == 2, "example 1");
        check(s.minDepth(build(2, null, 3, null, 4, null, 5, null, 6)) == 5, "example 2");
        check(s.minDepth(build(1)) == 1, "single");
        check(s.minDepth(null) == 0, "empty");
        // a missing child is not a leaf: the root here has depth 2
        check(s.minDepth(build(1, 2)) == 2, "one child");
        check(s.minDepth(build(1, 2, 3, 4, 5, null, 6, null, null, 7)) == 3, "mixed");
    }
}
