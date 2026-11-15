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
    private int best;

    public int diameterOfBinaryTree(TreeNode root) {
        best = 0;
        height(root);
        return best;
    }

    // returns the height: nodes on the longest path down
    private int height(TreeNode node) {
        if (node == null) return 0;
        int left = height(node.left);
        int right = height(node.right);
        // the longest path that bends at this node, in edges
        best = Math.max(best, left + right);
        // the parent only needs the taller side
        return 1 + Math.max(left, right);
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
        check(s.diameterOfBinaryTree(build(1, 2, 3, 4, 5)) == 3, "example 1");
        check(s.diameterOfBinaryTree(build(1, 2)) == 1, "example 2");
        check(s.diameterOfBinaryTree(build(1)) == 0, "single");
        check(s.diameterOfBinaryTree(null) == 0, "empty");
        // the longest path doesn't pass through the root
        check(s.diameterOfBinaryTree(build(1, 2, null, 3, 4, 5, null, null, 6, 7, null, null, 8)) == 6, "off root");
        // a straight line of four nodes
        check(s.diameterOfBinaryTree(build(1, 2, null, 3, null, 4)) == 3, "line");
    }
}
