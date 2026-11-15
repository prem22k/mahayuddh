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
def good_nodes(root: TreeNode) -> int:
    # top_max: the largest value on the path from the root
    def dfs(node: Optional[TreeNode], top_max: int) -> int:
        if not node:
            return 0
        good = 1 if node.val >= top_max else 0
        # hand each child the max of the path so far
        top_max = max(top_max, node.val)
        left = dfs(node.left, top_max)
        right = dfs(node.right, top_max)
        return good + left + right

    return dfs(root, root.val)
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


assert good_nodes(build([3, 1, 4, 3, None, 1, 5])) == 4
assert good_nodes(build([3, 3, None, 4, 2])) == 3
assert good_nodes(build([1])) == 1
# the max must not leak from one branch into the other
assert good_nodes(build([2, 9, 3, None, None, 4, 1])) == 4
assert good_nodes(build([-1, -2, -1])) == 2
