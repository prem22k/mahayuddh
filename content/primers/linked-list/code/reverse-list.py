from typing import Optional


class ListNode:
    def __init__(self, val: int = 0, next: "Optional[ListNode]" = None):
        self.val = val
        self.next = next
# ---- code ----
def reverse_list(
    head: Optional[ListNode],
) -> Optional[ListNode]:
    prev = None
    curr = head
    while curr:
        # 1. save the rest before cutting the link
        nxt = curr.next
        # 2. turn this node's link backwards
        curr.next = prev
        # 3. step both pointers forward
        prev = curr
        curr = nxt
    # curr fell off the end; prev is the old tail
    return prev
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


assert to_list(reverse_list(build([1, 2, 3, 4, 5]))) == [5, 4, 3, 2, 1]
assert to_list(reverse_list(build([1, 2]))) == [2, 1]
assert to_list(reverse_list(build([7]))) == [7]
assert reverse_list(None) is None
# the old head must now end the list
head = build([1, 2, 3])
new_head = reverse_list(head)
assert head.next is None and new_head.val == 3
