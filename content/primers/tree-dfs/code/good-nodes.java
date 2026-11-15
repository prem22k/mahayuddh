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
    public int goodNodes(TreeNode root) {
        return dfs(root, root.val);
    }

    // topMax: the largest value on the path from the root
    private int dfs(TreeNode node, int topMax) {
        if (node == null) return 0;
        int good = node.val >= topMax ? 1 : 0;
        // hand each child the max of the path so far
        topMax = Math.max(topMax, node.val);
        int left = dfs(node.left, topMax);
        int right = dfs(node.right, topMax);
        return good + left + right;
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
        check(s.goodNodes(build(3, 1, 4, 3, null, 1, 5)) == 4, "example 1");
        check(s.goodNodes(build(3, 3, null, 4, 2)) == 3, "example 2");
        check(s.goodNodes(build(1)) == 1, "single");
        // the max must not leak from one branch into the other
        check(s.goodNodes(build(2, 9, 3, null, null, 4, 1)) == 4, "branches");
        check(s.goodNodes(build(-1, -2, -1)) == 2, "negatives");
    }
}
