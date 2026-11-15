#include <cassert>
#include <vector>
using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};
// ---- code ----
ListNode* mergeTwoLists(ListNode* a, ListNode* b) {
    // a dummy head: the first node is no special case
    ListNode dummy;
    ListNode* tail = &dummy;
    while (a && b) {
        // link the smaller head; ties take from a
        if (a->val <= b->val) {
            tail->next = a;
            a = a->next;
        } else {
            tail->next = b;
            b = b->next;
        }
        tail = tail->next;
    }
    // one list ran out: the other is already sorted
    tail->next = a ? a : b;
    return dummy.next;
}
// ---- checks ----
ListNode* build(const vector<int>& vals) {
    ListNode dummy;
    ListNode* tail = &dummy;
    for (int v : vals) {
        tail->next = new ListNode(v);
        tail = tail->next;
    }
    return dummy.next;
}

vector<int> toList(ListNode* head) {
    vector<int> out;
    for (; head; head = head->next) out.push_back(head->val);
    return out;
}

vector<int> merged(const vector<int>& x, const vector<int>& y) {
    return toList(mergeTwoLists(build(x), build(y)));
}

int main() {
    assert((merged({1, 2, 4}, {1, 3, 4}) == vector<int>{1, 1, 2, 3, 4, 4}));
    assert((merged({}, {}) == vector<int>{}));
    assert((merged({}, {0}) == vector<int>{0}));
    assert((merged({5}, {}) == vector<int>{5}));
    // one list is entirely smaller than the other
    assert((merged({7, 8, 9}, {1, 2}) == vector<int>{1, 2, 7, 8, 9}));
    assert((merged({-3, 0, 0}, {-3, 2}) == vector<int>{-3, -3, 0, 0, 2}));
    return 0;
}
