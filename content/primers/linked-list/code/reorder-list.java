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
    public void reorderList(ListNode head) {
        if (head == null) return;
        // 1. middle: slow stops at the end of the first half
        ListNode slow = head;
        ListNode fast = head;
        while (fast.next != null && fast.next.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        // 2. cut after slow, then reverse the second half
        ListNode prev = null;
        ListNode curr = slow.next;
        slow.next = null;
        while (curr != null) {
            ListNode nxt = curr.next;
            curr.next = prev;
            prev = curr;
            curr = nxt;
        }
        // 3. weave: one node from each half in turn
        ListNode first = head;
        ListNode second = prev;
        while (second != null) {
            ListNode n1 = first.next;
            ListNode n2 = second.next;
            first.next = second;
            second.next = n1;
            first = n1;
            second = n2;
        }
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

    static List<Integer> reordered(int... vals) {
        ListNode head = build(vals);
        new Solution().reorderList(head);
        return toList(head);
    }

    public static void main(String[] args) {
        check(reordered(1, 2, 3, 4).equals(List.of(1, 4, 2, 3)), "even");
        check(reordered(1, 2, 3, 4, 5).equals(List.of(1, 5, 2, 4, 3)), "odd");
        check(reordered(1).equals(List.of(1)), "one");
        check(reordered(1, 2).equals(List.of(1, 2)), "two");
        check(reordered(1, 2, 3).equals(List.of(1, 3, 2)), "three");
        check(reordered().equals(List.of()), "empty");
        // toList would loop forever if a cut was missed
        check(reordered(1, 2, 3, 4, 5, 6, 7, 8).equals(List.of(1, 8, 2, 7, 3, 6, 4, 5)), "eight");
    }
}
