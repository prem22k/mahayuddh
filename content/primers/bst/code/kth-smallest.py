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
def kth_smallest(root: Optional[TreeNode], k: int) -> int:
    stack: list[TreeNode] = []
    node = root
    while True:
        # go as far left as possible
        while node:
            stack.append(node)
            node = node.left
        # the next value in sorted order
        node = stack.pop()
        k -= 1
        if k == 0:
            return node.val
        node = node.right
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
assert kth_smallest(build([3, 1, 4, N, 2]), 1) == 1
assert kth_smallest(build([5, 3, 6, 2, 4, N, N, 1]), 3) == 3
assert kth_smallest(build([1]), 1) == 1
# k = n: the largest value, the last one popped
assert kth_smallest(build([5, 3, 6, 2, 4, N, N, 1]), 6) == 6
# a chain to the right: nothing ever sits on the left
assert kth_smallest(build([1, N, 2, N, 3, N, 4]), 3) == 3
for k in range(1, 8):
    assert kth_smallest(build([4, 2, 6, 1, 3, 5, 7]), k) == k
