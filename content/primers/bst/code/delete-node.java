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
    // returns the root of this subtree after the delete
    public TreeNode deleteNode(TreeNode root, int key) {
        if (root == null) return null;
        if (key < root.val) {
            // go one way and re-attach what comes back
            root.left = deleteNode(root.left, key);
        } else if (key > root.val) {
            root.right = deleteNode(root.right, key);
        } else if (root.left == null) {
            // found it, with at most one child: lift that child
            return root.right;
        } else if (root.right == null) {
            return root.left;
        } else {
            // two children: copy the next larger value up,
            // then delete that value from the right subtree
            TreeNode succ = root.right;
            while (succ.left != null) succ = succ.left;
            root.val = succ.val;
            root.right = deleteNode(root.right, succ.val);
        }
        return root;
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

    static void inorder(TreeNode node, List<Integer> out) {
        if (node == null) return;
        inorder(node.left, out);
        out.add(node.val);
        inorder(node.right, out);
    }

    static boolean valid(TreeNode node, long lo, long hi) {
        if (node == null) return true;
        return lo < node.val && node.val < hi && valid(node.left, lo, node.val)
            && valid(node.right, node.val, hi);
    }

    static List<Integer> after(Integer[] vals, int key) {
        TreeNode root = new Solution().deleteNode(build(vals), key);
        check(valid(root, Long.MIN_VALUE, Long.MAX_VALUE), "still a BST");
        List<Integer> out = new ArrayList<>();
        inorder(root, out);
        return out;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        Integer N = null;
        Integer[] t = {5, 3, 6, 2, 4, N, 7};
        // two children: 3 takes its successor's value, 4
        check(after(t, 3).equals(List.of(2, 4, 5, 6, 7)), "example 1");
        check(s.deleteNode(build(t), 3).left.val == 4, "successor moved up");
        // key not in the tree: nothing changes
        check(after(t, 0).equals(List.of(2, 3, 4, 5, 6, 7)), "missing key");
        check(s.deleteNode(null, 0) == null, "empty");
        // deleting the root
        check(after(t, 5).equals(List.of(2, 3, 4, 6, 7)), "root");
        // a leaf, and a node with one child
        check(after(t, 2).equals(List.of(3, 4, 5, 6, 7)), "leaf");
        check(after(t, 6).equals(List.of(2, 3, 4, 5, 7)), "one child");
        check(s.deleteNode(build(1), 1) == null, "single");
        // the successor has a right child that must be kept
        check(after(new Integer[] {5, 3, 8, N, N, 6, 9, N, 7}, 5).equals(List.of(3, 6, 7, 8, 9)), "successor child");
    }
}
