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
void reorderList(ListNode* head) {
    if (!head) return;
    // 1. middle: slow stops at the end of the first half
    ListNode* slow = head;
    ListNode* fast = head;
    while (fast->next && fast->next->next) {
        slow = slow->next;
        fast = fast->next->next;
    }
    // 2. cut after slow, then reverse the second half
    ListNode* prev = nullptr;
    ListNode* curr = slow->next;
    slow->next = nullptr;
    while (curr) {
        ListNode* nxt = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nxt;
    }
    // 3. weave: one node from each half in turn
    ListNode* first = head;
    ListNode* second = prev;
    while (second) {
        ListNode* n1 = first->next;
        ListNode* n2 = second->next;
        first->next = second;
        second->next = n1;
        first = n1;
        second = n2;
    }
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

vector<int> reordered(const vector<int>& vals) {
    ListNode* head = build(vals);
    reorderList(head);
    return toList(head);
}

int main() {
    assert((reordered({1, 2, 3, 4}) == vector<int>{1, 4, 2, 3}));
    assert((reordered({1, 2, 3, 4, 5}) == vector<int>{1, 5, 2, 4, 3}));
    assert((reordered({1}) == vector<int>{1}));
    assert((reordered({1, 2}) == vector<int>{1, 2}));
    assert((reordered({1, 2, 3}) == vector<int>{1, 3, 2}));
    assert((reordered({}) == vector<int>{}));
    // toList would loop forever if a cut was missed
    assert((reordered({1, 2, 3, 4, 5, 6, 7, 8}) == vector<int>{1, 8, 2, 7, 3, 6, 4, 5}));
    return 0;
}
