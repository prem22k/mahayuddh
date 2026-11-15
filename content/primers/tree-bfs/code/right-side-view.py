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
def right_side_view(root: Optional[TreeNode]) -> list[int]:
    if not root:
        return []
    out = []
    queue = deque([root])
    while queue:
        size = len(queue)
        for i in range(size):
            node = queue.popleft()
            # the last node of the level is the one you see
            if i == size - 1:
                out.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
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


assert right_side_view(build([1, 2, 3, None, 5, None, 4])) == [1, 3, 4]
assert right_side_view(build([1, None, 3])) == [1, 3]
assert right_side_view(None) == []
# the deepest level only has a left node: it still shows
assert right_side_view(build([1, 2, 3, 4])) == [1, 3, 4]
assert right_side_view(build([1, 2, None, 3])) == [1, 2, 3]
