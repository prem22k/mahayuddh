import heapq
from typing import Optional


class ListNode:
    def __init__(self, val: int = 0, next: "Optional[ListNode]" = None):
        self.val = val
        self.next = next
# ---- code ----
def merge_k_lists(
    lists: list[Optional[ListNode]],
) -> Optional[ListNode]:
    # (value, list index): one entry per non-empty list
    heap = []
    for i, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, i))
    dummy = ListNode()
    tail = dummy
    while heap:
        # the smallest head among all the lists
        _, i = heapq.heappop(heap)
        tail.next = lists[i]
        tail = tail.next
        # that list's next node takes its place
        lists[i] = lists[i].next
        if lists[i]:
            heapq.heappush(heap, (lists[i].val, i))
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


def merged(*vals: list[int]) -> list[int]:
    return to_list(merge_k_lists([build(v) for v in vals]))


assert merged([1, 4, 5], [1, 3, 4], [2, 6]) == [1, 1, 2, 3, 4, 4, 5, 6]
assert merged() == []
assert merged([]) == []
assert merged([], [3], []) == [3]
# equal values in several lists at once
assert merged([2, 2], [2], [1, 2]) == [1, 2, 2, 2, 2]
assert merged([-5, 10], [0], [7, 8, 9]) == [-5, 0, 7, 8, 9, 10]
