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
    public TreeNode lowestCommonAncestor(
            TreeNode root, TreeNode p, TreeNode q) {
        // returns p, q, their LCA, or null if neither is below
        if (root == null || root == p || root == q) return root;
        TreeNode left = lowestCommonAncestor(root.left, p, q);
        TreeNode right = lowestCommonAncestor(root.right, p, q);
        // one found on each side: they meet here
        if (left != null && right != null) return root;
        // otherwise pass up whatever was found
        return left != null ? left : right;
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

    static TreeNode find(TreeNode root, int val) {
        if (root == null || root.val == val) return root;
        TreeNode l = find(root.left, val);
        return l != null ? l : find(root.right, val);
    }

    static int lca(Integer[] vals, int p, int q) {
        TreeNode root = build(vals);
        return new Solution().lowestCommonAncestor(root, find(root, p), find(root, q)).val;
    }

    public static void main(String[] args) {
        Integer[] t = {3, 5, 1, 6, 2, 0, 8, null, null, 7, 4};
        check(lca(t, 5, 1) == 3, "example 1");
        // a node is its own ancestor
        check(lca(t, 5, 4) == 5, "example 2");
        check(lca(t, 7, 4) == 2, "siblings");
        check(lca(t, 6, 4) == 5, "cousins");
        check(lca(new Integer[]{1, 2}, 1, 2) == 1, "root and child");
        // both deep on the same side, far from the root
        check(lca(t, 7, 6) == 5, "deep");
    }
}
