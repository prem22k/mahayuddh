#include <cassert>
#include <climits>
#include <queue>
#include <stack>
#include <vector>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right)
        : val(x), left(left), right(right) {}
};
// ---- code ----
int kthSmallest(TreeNode* root, int k) {
    stack<TreeNode*> st;
    TreeNode* node = root;
    while (true) {
        // go as far left as possible
        while (node) {
            st.push(node);
            node = node->left;
        }
        // the next value in sorted order
        node = st.top();
        st.pop();
        k--;
        if (k == 0) return node->val;
        node = node->right;
    }
}
// ---- checks ----
const int N = INT_MIN;  // a missing child in build()

TreeNode* build(const vector<int>& vals) {
    if (vals.empty() || vals[0] == N) return nullptr;
    TreeNode* root = new TreeNode(vals[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < vals.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < vals.size() && vals[i] != N) {
            node->left = new TreeNode(vals[i]);
            q.push(node->left);
        }
        ++i;
        if (i < vals.size() && vals[i] != N) {
            node->right = new TreeNode(vals[i]);
            q.push(node->right);
        }
        ++i;
    }
    return root;
}

int main() {
    assert(kthSmallest(build({3, 1, 4, N, 2}), 1) == 1);
    assert(kthSmallest(build({5, 3, 6, 2, 4, N, N, 1}), 3) == 3);
    assert(kthSmallest(build({1}), 1) == 1);
    // k = n: the largest value, the last one popped
    assert(kthSmallest(build({5, 3, 6, 2, 4, N, N, 1}), 6) == 6);
    // a chain to the right: nothing ever sits on the left
    assert(kthSmallest(build({1, N, 2, N, 3, N, 4}), 3) == 3);
    for (int k = 1; k <= 7; k++)
        assert(kthSmallest(build({4, 2, 6, 1, 3, 5, 7}), k) == k);
    return 0;
}
