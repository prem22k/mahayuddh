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
    public ListNode mergeKLists(ListNode[] lists) {
        // (value, list index): one entry per non-empty list
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> a[0] != b[0]
                ? Integer.compare(a[0], b[0])
                : Integer.compare(a[1], b[1]));
        for (int i = 0; i < lists.length; i++) {
            if (lists[i] != null) {
                heap.offer(new int[]{lists[i].val, i});
            }
        }
        ListNode dummy = new ListNode();
        ListNode tail = dummy;
        while (!heap.isEmpty()) {
            // the smallest head among all the lists
            int i = heap.poll()[1];
            tail.next = lists[i];
            tail = tail.next;
            // that list's next node takes its place
            lists[i] = lists[i].next;
            if (lists[i] != null) {
                heap.offer(new int[]{lists[i].val, i});
            }
        }
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

    static List<Integer> merged(int[]... vals) {
        ListNode[] lists = new ListNode[vals.length];
        for (int i = 0; i < vals.length; i++) lists[i] = build(vals[i]);
        return toList(new Solution().mergeKLists(lists));
    }

    public static void main(String[] args) {
        check(merged(new int[]{1, 4, 5}, new int[]{1, 3, 4}, new int[]{2, 6})
            .equals(List.of(1, 1, 2, 3, 4, 4, 5, 6)), "example 1");
        check(merged().equals(List.of()), "no lists");
        check(merged(new int[]{}).equals(List.of()), "one empty list");
        check(merged(new int[]{}, new int[]{3}, new int[]{}).equals(List.of(3)), "empties around");
        // equal values in several lists at once
        check(merged(new int[]{2, 2}, new int[]{2}, new int[]{1, 2}).equals(List.of(1, 2, 2, 2, 2)), "ties");
        check(merged(new int[]{-5, 10}, new int[]{0}, new int[]{7, 8, 9})
            .equals(List.of(-5, 0, 7, 8, 9, 10)), "spread");
    }
}
