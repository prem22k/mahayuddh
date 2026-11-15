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
    public boolean isValidBST(TreeNode root) {
        return check(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    // every value in this subtree must be inside (lo, hi)
    private boolean check(TreeNode node, long lo, long hi) {
        if (node == null) return true;
        if (node.val <= lo || node.val >= hi) return false;
        // left: below this node; right: above it
        return check(node.left, lo, node.val)
            && check(node.right, node.val, hi);
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
        Integer N = null;
        // the walkthrough: 9 is above its parent 6 but not below 8
        check(!s.isValidBST(build(8, 4, 12, 2, 6, 10, 14, N, N, 5, 9)), "walkthrough");
        check(s.isValidBST(build(8, 4, 12, 2, 6, 10, 14, N, N, 5, 7)), "fixed");
        check(s.isValidBST(build(2, 1, 3)), "example 1");
        check(!s.isValidBST(build(5, 1, 4, N, N, 3, 6)), "example 2");
        check(s.isValidBST(build(1)), "single");
        check(s.isValidBST(null), "empty");
        // equal values are not allowed
        check(!s.isValidBST(build(2, 2, 2)), "equal");
        // an equal value on the right breaks the rule too
        check(!s.isValidBST(build(2, 1, 2)), "equal on the right");
        // 3 is below its parent 6 but not above the root 5
        check(!s.isValidBST(build(5, 4, 6, N, N, 3, 7)), "grandparent");
        // the int limits themselves are valid values
        check(s.isValidBST(build(-2147483648, N, 2147483647)), "limits");
        check(s.isValidBST(build(2147483647)), "max");
    }
}
