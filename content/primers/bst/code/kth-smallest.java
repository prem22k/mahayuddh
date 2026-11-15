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
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode node = root;
        while (true) {
            // go as far left as possible
            while (node != null) {
                stack.push(node);
                node = node.left;
            }
            // the next value in sorted order
            node = stack.pop();
            k--;
            if (k == 0) return node.val;
            node = node.right;
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

    public static void main(String[] args) {
        Solution s = new Solution();
        Integer N = null;
        check(s.kthSmallest(build(3, 1, 4, N, 2), 1) == 1, "example 1");
        check(s.kthSmallest(build(5, 3, 6, 2, 4, N, N, 1), 3) == 3, "example 2");
        check(s.kthSmallest(build(1), 1) == 1, "single");
        // k = n: the largest value, the last one popped
        check(s.kthSmallest(build(5, 3, 6, 2, 4, N, N, 1), 6) == 6, "k = n");
        // a chain to the right: nothing ever sits on the left
        check(s.kthSmallest(build(1, N, 2, N, 3, N, 4), 3) == 3, "right chain");
        for (int k = 1; k <= 7; k++)
            check(s.kthSmallest(build(4, 2, 6, 1, 3, 5, 7), k) == k, "full k=" + k);
    }
}
