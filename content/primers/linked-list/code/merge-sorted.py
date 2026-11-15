from typing import Optional


class ListNode:
    def __init__(self, val: int = 0, next: "Optional[ListNode]" = None):
        self.val = val
        self.next = next
# ---- code ----
def merge_two_lists(
    a: Optional[ListNode], b: Optional[ListNode]
) -> Optional[ListNode]:
    # a dummy head: the first node is no special case
    dummy = ListNode()
    tail = dummy
    while a and b:
        # link the smaller head; ties take from a
        if a.val <= b.val:
            tail.next = a
            a = a.next
        else:
            tail.next = b
            b = b.next
        tail = tail.next
    # one list ran out: the other is already sorted
    tail.next = a if a else b
    return dummy.next
# ---- checks ----
def build(vals: list[int]) -> Optional[ListNode]:
    dummy = ListNode()
    tail = dummy
    for v in vals:
        tail.next = ListNode(v)
        tail = tail.next
    return dummy.next


def to_list(head: Optional[ListNode]) -> list[int]:
    out = []
    while head:
        out.append(head.val)
        head = head.next
    return out


def merged(x: list[int], y: list[int]) -> list[int]:
    return to_list(merge_two_lists(build(x), build(y)))


assert merged([1, 2, 4], [1, 3, 4]) == [1, 1, 2, 3, 4, 4]
assert merged([], []) == []
assert merged([], [0]) == [0]
assert merged([5], []) == [5]
# one list is entirely smaller than the other
assert merged([7, 8, 9], [1, 2]) == [1, 2, 7, 8, 9]
assert merged([-3, 0, 0], [-3, 2]) == [-3, -3, 0, 0, 2]
