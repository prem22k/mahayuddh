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
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        // a dummy head: the first node is no special case
        ListNode dummy = new ListNode();
        ListNode tail = dummy;
        while (a != null && b != null) {
            // link the smaller head; ties take from a
            if (a.val <= b.val) {
                tail.next = a;
                a = a.next;
            } else {
                tail.next = b;
                b = b.next;
            }
            tail = tail.next;
        }
        // one list ran out: the other is already sorted
        tail.next = (a != null) ? a : b;
        return dummy.next;
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

    static List<Integer> merged(int[] x, int[] y) {
        return toList(new Solution().mergeTwoLists(build(x), build(y)));
    }

    public static void main(String[] args) {
        check(merged(new int[]{1, 2, 4}, new int[]{1, 3, 4}).equals(List.of(1, 1, 2, 3, 4, 4)), "example");
        check(merged(new int[]{}, new int[]{}).equals(List.of()), "both empty");
        check(merged(new int[]{}, new int[]{0}).equals(List.of(0)), "a empty");
        check(merged(new int[]{5}, new int[]{}).equals(List.of(5)), "b empty");
        // one list is entirely smaller than the other
        check(merged(new int[]{7, 8, 9}, new int[]{1, 2}).equals(List.of(1, 2, 7, 8, 9)), "disjoint");
        check(merged(new int[]{-3, 0, 0}, new int[]{-3, 2}).equals(List.of(-3, -3, 0, 0, 2)), "dupes");
    }
}
