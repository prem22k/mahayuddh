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
ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        // 1. save the rest before cutting the link
        ListNode* nxt = curr->next;
        // 2. turn this node's link backwards
        curr->next = prev;
        // 3. step both pointers forward
        prev = curr;
        curr = nxt;
    }
    // curr fell off the end; prev is the old tail
    return prev;
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

int main() {
    assert((toList(reverseList(build({1, 2, 3, 4, 5}))) == vector<int>{5, 4, 3, 2, 1}));
    assert((toList(reverseList(build({1, 2}))) == vector<int>{2, 1}));
    assert((toList(reverseList(build({7}))) == vector<int>{7}));
    assert(reverseList(nullptr) == nullptr);
    // the old head must now end the list
    ListNode* head = build({1, 2, 3});
    ListNode* newHead = reverseList(head);
    assert(head->next == nullptr && newHead->val == 3);
    return 0;
}
