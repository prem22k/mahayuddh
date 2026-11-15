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
def lowest_common_ancestor(
    root: Optional[TreeNode], p: TreeNode, q: TreeNode
) -> Optional[TreeNode]:
    # returns p, q, their LCA, or None if neither is below
    if not root or root is p or root is q:
        return root
    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)
    # one found on each side: they meet here
    if left and right:
        return root
    # otherwise pass up whatever was found
    return left if left else right
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


def find(root: Optional[TreeNode], val: int) -> Optional[TreeNode]:
    if not root or root.val == val:
        return root
    return find(root.left, val) or find(root.right, val)


def lca(vals: list, p: int, q: int) -> int:
    root = build(vals)
    return lowest_common_ancestor(root, find(root, p), find(root, q)).val


t = [3, 5, 1, 6, 2, 0, 8, None, None, 7, 4]
assert lca(t, 5, 1) == 3
# a node is its own ancestor
assert lca(t, 5, 4) == 5
assert lca(t, 7, 4) == 2
assert lca(t, 6, 4) == 5
assert lca([1, 2], 1, 2) == 1
# both deep on the same side, far from the root
assert lca(t, 7, 6) == 5
