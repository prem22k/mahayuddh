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
    public List<List<Integer>> pathSum(TreeNode root,
                                       int target) {
        List<List<Integer>> out = new ArrayList<>();
        dfs(root, target, new ArrayList<>(), out);
        return out;
    }

    private void dfs(TreeNode node, int remaining,
                     List<Integer> path,
                     List<List<Integer>> out) {
        if (node == null) return;
        // on the way down: this node joins the path
        path.add(node.val);
        remaining -= node.val;
        // a leaf that uses up the target exactly
        if (node.left == null && node.right == null
                && remaining == 0) {
            out.add(new ArrayList<>(path));
        }
        dfs(node.left, remaining, path, out);
        dfs(node.right, remaining, path, out);
        // on the way up: undo, so the path is clean again
        path.remove(path.size() - 1);
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
        TreeNode t = build(5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1);
        check(s.pathSum(t, 22).equals(List.of(List.of(5, 4, 11, 2), List.of(5, 8, 4, 5))), "example 1");
        check(s.pathSum(build(1, 2, 3), 5).isEmpty(), "example 2");
        check(s.pathSum(build(1, 2), 0).isEmpty(), "example 3");
        check(s.pathSum(null, 0).isEmpty(), "empty");
        // a node with one child is not a leaf
        check(s.pathSum(build(1, 2), 1).isEmpty(), "not a leaf");
        // negative values: the sum can dip and come back
        check(s.pathSum(build(-2, null, -3), -5).equals(List.of(List.of(-2, -3))), "negatives");
        check(s.pathSum(build(1, -1, -1, 1, null, 1), 1)
            .equals(List.of(List.of(1, -1, 1), List.of(1, -1, 1))), "two paths");
    }
}
