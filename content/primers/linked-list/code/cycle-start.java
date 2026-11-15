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
    public ListNode detectCycle(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            // they met somewhere inside the loop
            if (slow == fast) {
                // restart one from head; both move one step
                slow = head;
                while (slow != fast) {
                    slow = slow.next;
                    fast = fast.next;
                }
                // they meet again at the loop's first node
                return slow;
            }
        }
        // fast reached the end: there is no loop
        return null;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static ListNode build(int[] vals, int pos) {
        ListNode[] nodes = new ListNode[vals.length];
        for (int i = 0; i < vals.length; i++) nodes[i] = new ListNode(vals[i]);
        for (int i = 0; i + 1 < vals.length; i++) nodes[i].next = nodes[i + 1];
        if (pos >= 0) nodes[vals.length - 1].next = nodes[pos];
        return vals.length == 0 ? null : nodes[0];
    }

    static int indexOf(ListNode head, ListNode node) {
        int i = 0;
        while (head != node) { head = head.next; i++; }
        return i;
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        ListNode h = build(new int[]{3, 2, 0, -4}, 1);
        check(indexOf(h, s.detectCycle(h)) == 1, "example 1");
        h = build(new int[]{1, 2}, 0);
        check(indexOf(h, s.detectCycle(h)) == 0, "example 2");
        check(s.detectCycle(build(new int[]{1}, -1)) == null, "single, no loop");
        check(s.detectCycle(build(new int[]{1, 2, 3, 4}, -1)) == null, "no loop");
        check(s.detectCycle(null) == null, "empty");
        // a node pointing at itself
        h = build(new int[]{1}, 0);
        check(s.detectCycle(h) == h, "self loop");
        // long tail, short loop: the first meeting is not the start
        h = build(new int[]{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, 7);
        check(indexOf(h, s.detectCycle(h)) == 7, "long tail");
    }
}
