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
def path_sum(
    root: Optional[TreeNode], target: int
) -> list[list[int]]:
    out = []
    path = []

    def dfs(node: Optional[TreeNode], remaining: int) -> None:
        if not node:
            return
        # on the way down: this node joins the path
        path.append(node.val)
        remaining -= node.val
        # a leaf that uses up the target exactly
        if not node.left and not node.right and remaining == 0:
            out.append(path.copy())
        dfs(node.left, remaining)
        dfs(node.right, remaining)
        # on the way up: undo, so the path is clean again
        path.pop()

    dfs(root, target)
    return out
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


t = [5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1]
assert path_sum(build(t), 22) == [[5, 4, 11, 2], [5, 8, 4, 5]]
assert path_sum(build([1, 2, 3]), 5) == []
assert path_sum(build([1, 2]), 0) == []
assert path_sum(None, 0) == []
# a node with one child is not a leaf
assert path_sum(build([1, 2]), 1) == []
# negative values: the sum can dip and come back
assert path_sum(build([-2, None, -3]), -5) == [[-2, -3]]
assert path_sum(build([1, -1, -1, 1, None, 1]), 1) == [[1, -1, 1], [1, -1, 1]]
