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
def diameter_of_binary_tree(root: Optional[TreeNode]) -> int:
    best = 0

    # returns the height: nodes on the longest path down
    def height(node: Optional[TreeNode]) -> int:
        nonlocal best
        if not node:
            return 0
        left = height(node.left)
        right = height(node.right)
        # the longest path that bends at this node, in edges
        best = max(best, left + right)
        # the parent only needs the taller side
        return 1 + max(left, right)

    height(root)
    return best
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


assert diameter_of_binary_tree(build([1, 2, 3, 4, 5])) == 3
assert diameter_of_binary_tree(build([1, 2])) == 1
assert diameter_of_binary_tree(build([1])) == 0
assert diameter_of_binary_tree(None) == 0
# the longest path doesn't pass through the root
deep = [1, 2, None, 3, 4, 5, None, None, 6, 7, None, None, 8]
assert diameter_of_binary_tree(build(deep)) == 6
# a straight line of four nodes
assert diameter_of_binary_tree(build([1, 2, None, 3, None, 4])) == 3
