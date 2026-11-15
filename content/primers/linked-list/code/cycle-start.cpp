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
ListNode* detectCycle(ListNode* head) {
    ListNode* slow = head;
    ListNode* fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        // they met somewhere inside the loop
        if (slow == fast) {
            // restart one from head; both move one step
            slow = head;
            while (slow != fast) {
                slow = slow->next;
                fast = fast->next;
            }
            // they meet again at the loop's first node
            return slow;
        }
    }
    // fast reached the end: there is no loop
    return nullptr;
}
// ---- checks ----
ListNode* build(const vector<int>& vals, int pos) {
    vector<ListNode*> nodes;
    for (int v : vals) nodes.push_back(new ListNode(v));
    for (size_t i = 0; i + 1 < nodes.size(); ++i) nodes[i]->next = nodes[i + 1];
    if (pos >= 0) nodes.back()->next = nodes[pos];
    return nodes.empty() ? nullptr : nodes[0];
}

int indexOf(ListNode* head, ListNode* node) {
    int i = 0;
    while (head != node) { head = head->next; ++i; }
    return i;
}

int main() {
    ListNode* h = build({3, 2, 0, -4}, 1);
    assert(indexOf(h, detectCycle(h)) == 1);
    h = build({1, 2}, 0);
    assert(indexOf(h, detectCycle(h)) == 0);
    assert(detectCycle(build({1}, -1)) == nullptr);
    assert(detectCycle(build({1, 2, 3, 4}, -1)) == nullptr);
    assert(detectCycle(nullptr) == nullptr);
    // a node pointing at itself
    h = build({1}, 0);
    assert(detectCycle(h) == h);
    // long tail, short loop: the first meeting is not the start
    h = build({0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, 7);
    assert(indexOf(h, detectCycle(h)) == 7);
    return 0;
}
