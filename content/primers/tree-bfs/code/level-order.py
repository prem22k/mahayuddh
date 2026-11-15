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
def level_order(root: Optional[TreeNode]) -> list[list[int]]:
    if not root:
        return []
    out = []
    queue = deque([root])
    while queue:
        level = []
        # everything in the queue right now is one level
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            # children wait behind the rest of this level
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        out.append(level)
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


assert level_order(build([3, 9, 20, None, None, 15, 7])) == [
    [3], [9, 20], [15, 7]]
assert level_order(build([1])) == [[1]]
assert level_order(None) == []
# a gap in the middle level must not shift the next one
assert level_order(build([1, 2, 3, None, 4, 5, None, 6])) == [
    [1], [2, 3], [4, 5], [6]]
# a chain: one node per level
assert level_order(build([1, None, 2, None, 3])) == [[1], [2], [3]]
