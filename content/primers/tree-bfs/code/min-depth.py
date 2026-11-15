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
def min_depth(root: Optional[TreeNode]) -> int:
    if not root:
        return 0
    queue = deque([root])
    depth = 1
    while queue:
        for _ in range(len(queue)):
            node = queue.popleft()
            # levels come in order: first leaf is closest
            if not node.left and not node.right:
                return depth
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        depth += 1
    return depth
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


assert min_depth(build([3, 9, 20, None, None, 15, 7])) == 2
assert min_depth(build([2, None, 3, None, 4, None, 5, None, 6])) == 5
assert min_depth(build([1])) == 1
assert min_depth(None) == 0
# a missing child is not a leaf: the root here has depth 2
assert min_depth(build([1, 2])) == 2
assert min_depth(build([1, 2, 3, 4, 5, None, 6, None, None, 7])) == 3
