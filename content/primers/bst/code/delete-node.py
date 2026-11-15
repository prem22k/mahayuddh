from collections import deque
from typing import Optional


class TreeNode:
    def __init__(
        self,
        val: int = 0,
        left: "Optional[TreeNode]" = None,
        right: "Optional[TreeNode]" = None,
    ):
        self.val = val
        self.left = left
        self.right = right
# ---- code ----
# returns the root of this subtree after the delete
def delete_node(root: Optional[TreeNode],
                key: int) -> Optional[TreeNode]:
    if not root:
        return None
    if key < root.val:
        # go one way and re-attach what comes back
        root.left = delete_node(root.left, key)
    elif key > root.val:
        root.right = delete_node(root.right, key)
    elif not root.left:
        # found it, with at most one child: lift that child
        return root.right
    elif not root.right:
        return root.left
    else:
        # two children: copy the next larger value up,
        # then delete that value from the right subtree
        succ = root.right
        while succ.left:
            succ = succ.left
        root.val = succ.val
        root.right = delete_node(root.right, succ.val)
    return root
# ---- checks ----
def build(vals: list) -> Optional[TreeNode]:
    if not vals or vals[0] is None:
        return None
    root = TreeNode(vals[0])
    queue = deque([root])
    i = 1
    while queue and i < len(vals):
        node = queue.popleft()
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i])
            queue.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i])
            queue.append(node.right)
        i += 1
    return root


def inorder(node: Optional[TreeNode], out: list) -> list:
    if node:
        inorder(node.left, out)
        out.append(node.val)
        inorder(node.right, out)
    return out


def valid(node: Optional[TreeNode], lo: float, hi: float) -> bool:
    if not node:
        return True
    return (lo < node.val < hi and valid(node.left, lo, node.val)
            and valid(node.right, node.val, hi))


def after(vals: list, key: int) -> list:
    root = delete_node(build(vals), key)
    assert valid(root, float("-inf"), float("inf"))
    return inorder(root, [])


N = None
T = [5, 3, 6, 2, 4, N, 7]
# two children: 3 takes its successor's value, 4
assert after(T, 3) == [2, 4, 5, 6, 7]
assert delete_node(build(T), 3).left.val == 4
# key not in the tree: nothing changes
assert after(T, 0) == [2, 3, 4, 5, 6, 7]
assert delete_node(None, 0) is None
# deleting the root
assert after(T, 5) == [2, 3, 4, 6, 7]
# a leaf, and a node with one child
assert after(T, 2) == [3, 4, 5, 6, 7]
assert after(T, 6) == [2, 3, 4, 5, 7]
assert delete_node(build([1]), 1) is None
# the successor has a right child that must be kept
assert after([5, 3, 8, N, N, 6, 9, N, 7], 5) == [3, 6, 7, 8, 9]
