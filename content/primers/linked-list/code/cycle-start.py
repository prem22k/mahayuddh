from typing import Optional


class ListNode:
    def __init__(self, val: int = 0, next: "Optional[ListNode]" = None):
        self.val = val
        self.next = next
# ---- code ----
def detect_cycle(
    head: Optional[ListNode],
) -> Optional[ListNode]:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        # they met somewhere inside the loop
        if slow is fast:
            # restart one from head; both move one step
            slow = head
            while slow is not fast:
                slow = slow.next
                fast = fast.next
            # they meet again at the loop's first node
            return slow
    # fast reached the end: there is no loop
    return None
# ---- checks ----
def build(vals: list[int], pos: int) -> Optional[ListNode]:
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if pos >= 0:
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None


def index_of(head: Optional[ListNode], node: ListNode) -> int:
    i = 0
    while head is not node:
        head = head.next
        i += 1
    return i


h = build([3, 2, 0, -4], 1)
assert index_of(h, detect_cycle(h)) == 1
h = build([1, 2], 0)
assert index_of(h, detect_cycle(h)) == 0
assert detect_cycle(build([1], -1)) is None
assert detect_cycle(build([1, 2, 3, 4], -1)) is None
assert detect_cycle(None) is None
# a node pointing at itself
h = build([1], 0)
assert detect_cycle(h) is h
# long tail, short loop: the first meeting is not the start
h = build(list(range(10)), 7)
assert index_of(h, detect_cycle(h)) == 7
