import java.util.*;

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
// ---- code ----
class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null;
        ListNode curr = head;
        while (curr != null) {
            // 1. save the rest before cutting the link
            ListNode nxt = curr.next;
            // 2. turn this node's link backwards
            curr.next = prev;
            // 3. step both pointers forward
            prev = curr;
            curr = nxt;
        }
        // curr fell off the end; prev is the old tail
        return prev;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static ListNode build(int... vals) {
        ListNode dummy = new ListNode();
        ListNode tail = dummy;
        for (int v : vals) {
            tail.next = new ListNode(v);
            tail = tail.next;
        }
        return dummy.next;
    }

    static List<Integer> toList(ListNode head) {
        List<Integer> out = new ArrayList<>();
        for (; head != null; head = head.next) out.add(head.val);
        return out;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(toList(s.reverseList(build(1, 2, 3, 4, 5))).equals(List.of(5, 4, 3, 2, 1)), "five");
        check(toList(s.reverseList(build(1, 2))).equals(List.of(2, 1)), "two");
        check(toList(s.reverseList(build(7))).equals(List.of(7)), "one");
        check(s.reverseList(null) == null, "empty");
        // the old head must now end the list
        ListNode head = build(1, 2, 3);
        ListNode newHead = s.reverseList(head);
        check(head.next == null && newHead.val == 3, "old head is the tail");
    }
}
