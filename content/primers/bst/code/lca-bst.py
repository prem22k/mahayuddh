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
def lowest_common_ancestor(root: TreeNode, p: TreeNode,
                           q: TreeNode) -> TreeNode:
    node = root
    while True:
        if p.val < node.val and q.val < node.val:
            # both smaller: the split is on the left
            node = node.left
        elif p.val > node.val and q.val > node.val:
            # both larger: the split is on the right
            node = node.right
        else:
            # they split here, or one of them is this node
            return node
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


def find(node: Optional[TreeNode], val: int) -> TreeNode:
    while node and node.val != val:
        node = node.left if val < node.val else node.right
    assert node
    return node


def lca(vals: list, p: int, q: int) -> int:
    root = build(vals)
    assert root
    got = lowest_common_ancestor(root, find(root, p), find(root, q))
    return got.val


N = None
T = [6, 2, 8, 0, 4, 7, 9, N, N, 3, 5]
assert lca(T, 2, 8) == 6
# one node is an ancestor of the other
assert lca(T, 2, 4) == 2
assert lca(T, 3, 5) == 4
assert lca(T, 7, 9) == 8
# p and q given larger first
assert lca(T, 5, 0) == 2
assert lca([2, 1], 2, 1) == 2
assert lca([1], 1, 1) == 1
