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
def is_valid_bst(root: Optional[TreeNode]) -> bool:
    # every value in this subtree must be inside (lo, hi)
    def check(node: Optional[TreeNode], lo: float,
              hi: float) -> bool:
        if not node:
            return True
        if node.val <= lo or node.val >= hi:
            return False
        # left: below this node; right: above it
        return (check(node.left, lo, node.val)
                and check(node.right, node.val, hi))

    return check(root, float("-inf"), float("inf"))
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


N = None
# the walkthrough: 9 is above its parent 6 but not below 8
assert not is_valid_bst(build([8, 4, 12, 2, 6, 10, 14, N, N, 5, 9]))
assert is_valid_bst(build([8, 4, 12, 2, 6, 10, 14, N, N, 5, 7]))
assert is_valid_bst(build([2, 1, 3]))
assert not is_valid_bst(build([5, 1, 4, N, N, 3, 6]))
assert is_valid_bst(build([1]))
assert is_valid_bst(None)
# equal values are not allowed
assert not is_valid_bst(build([2, 2, 2]))
# an equal value on the right breaks the rule too
assert not is_valid_bst(build([2, 1, 2]))
# 3 is below its parent 6 but not above the root 5
assert not is_valid_bst(build([5, 4, 6, N, N, 3, 7]))
# the int limits themselves are valid values
assert is_valid_bst(build([-2147483648, N, 2147483647]))
assert is_valid_bst(build([2147483647]))
