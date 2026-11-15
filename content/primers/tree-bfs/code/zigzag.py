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
def zigzag_level_order(
    root: Optional[TreeNode],
) -> list[list[int]]:
    if not root:
        return []
    out = []
    queue = deque([root])
    left_to_right = True
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            # queue order never changes, only the output
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        if not left_to_right:
            level.reverse()
        out.append(level)
        left_to_right = not left_to_right
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


assert zigzag_level_order(build([3, 9, 20, None, None, 15, 7])) == [
    [3], [20, 9], [15, 7]]
assert zigzag_level_order(build([1])) == [[1]]
assert zigzag_level_order(None) == []
# four levels: the direction flips back on the third
assert zigzag_level_order(build([1, 2, 3, 4, 5, 6, 7, 8, 9])) == [
    [1], [3, 2], [4, 5, 6, 7], [9, 8]]
