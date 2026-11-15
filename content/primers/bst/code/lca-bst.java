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
    public TreeNode lowestCommonAncestor(TreeNode root,
            TreeNode p, TreeNode q) {
        TreeNode node = root;
        while (true) {
            if (p.val < node.val && q.val < node.val) {
                // both smaller: the split is on the left
                node = node.left;
            } else if (p.val > node.val && q.val > node.val) {
                // both larger: the split is on the right
                node = node.right;
            } else {
                // they split here, or one of them is this node
                return node;
            }
        }
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

    static TreeNode find(TreeNode node, int val) {
        while (node != null && node.val != val)
            node = val < node.val ? node.left : node.right;
        check(node != null, "find " + val);
        return node;
    }

    static int lca(Integer[] vals, int p, int q) {
        TreeNode root = build(vals);
        return new Solution().lowestCommonAncestor(root, find(root, p), find(root, q)).val;
    }

    public static void main(String[] args) {
        Integer N = null;
        Integer[] t = {6, 2, 8, 0, 4, 7, 9, N, N, 3, 5};
        check(lca(t, 2, 8) == 6, "example 1");
        // one node is an ancestor of the other
        check(lca(t, 2, 4) == 2, "example 2");
        check(lca(t, 3, 5) == 4, "deep");
        check(lca(t, 7, 9) == 8, "right side");
        // p and q given larger first
        check(lca(t, 5, 0) == 2, "swapped");
        check(lca(new Integer[] {2, 1}, 2, 1) == 2, "example 3");
        check(lca(new Integer[] {1}, 1, 1) == 1, "same node");
    }
}
