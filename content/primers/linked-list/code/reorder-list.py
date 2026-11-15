from typing import Optional


class ListNode:
    def __init__(self, val: int = 0, next: "Optional[ListNode]" = None):
        self.val = val
        self.next = next
# ---- code ----
def reorder_list(head: Optional[ListNode]) -> None:
    if not head:
        return
    # 1. middle: slow stops at the end of the first half
    slow = fast = head
    while fast.next and fast.next.next:
        slow = slow.next
        fast = fast.next.next
    # 2. cut after slow, then reverse the second half
    prev, curr = None, slow.next
    slow.next = None
    while curr:
        nxt = curr.next
        curr.next = prev
        prev, curr = curr, nxt
    # 3. weave: one node from each half in turn
    first, second = head, prev
    while second:
        n1, n2 = first.next, second.next
        first.next = second
        second.next = n1
        first, second = n1, n2
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


def reordered(vals: list[int]) -> list[int]:
    head = build(vals)
    reorder_list(head)
    return to_list(head)


assert reordered([1, 2, 3, 4]) == [1, 4, 2, 3]
assert reordered([1, 2, 3, 4, 5]) == [1, 5, 2, 4, 3]
assert reordered([1]) == [1]
assert reordered([1, 2]) == [1, 2]
assert reordered([1, 2, 3]) == [1, 3, 2]
assert reordered([]) == []
# to_list would loop forever if a cut was missed
assert reordered(list(range(1, 9))) == [1, 8, 2, 7, 3, 6, 4, 5]
