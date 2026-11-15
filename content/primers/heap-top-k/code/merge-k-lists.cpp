#include <cassert>
#include <functional>
#include <queue>
#include <utility>
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
ListNode* mergeKLists(vector<ListNode*>& lists) {
    // (value, list index): one entry per non-empty list
    priority_queue<pair<int, int>, vector<pair<int, int>>,
                   greater<pair<int, int>>> heap;
    for (int i = 0; i < (int)lists.size(); ++i) {
        if (lists[i]) heap.push({lists[i]->val, i});
    }
    ListNode dummy;
    ListNode* tail = &dummy;
    while (!heap.empty()) {
        // the smallest head among all the lists
        int i = heap.top().second;
        heap.pop();
        tail->next = lists[i];
        tail = tail->next;
        // that list's next node takes its place
        lists[i] = lists[i]->next;
        if (lists[i]) heap.push({lists[i]->val, i});
    }
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

vector<int> merged(const vector<vector<int>>& vals) {
    vector<ListNode*> lists;
    for (const auto& v : vals) lists.push_back(build(v));
    return toList(mergeKLists(lists));
}

int main() {
    assert((merged({{1, 4, 5}, {1, 3, 4}, {2, 6}}) == vector<int>{1, 1, 2, 3, 4, 4, 5, 6}));
    assert((merged({}) == vector<int>{}));
    assert((merged({{}}) == vector<int>{}));
    assert((merged({{}, {3}, {}}) == vector<int>{3}));
    // equal values in several lists at once
    assert((merged({{2, 2}, {2}, {1, 2}}) == vector<int>{1, 2, 2, 2, 2}));
    assert((merged({{-5, 10}, {0}, {7, 8, 9}}) == vector<int>{-5, 0, 7, 8, 9, 10}));
    return 0;
}
