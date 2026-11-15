#include <cassert>
#include <climits>
#include <queue>
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
TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p,
                               TreeNode* q) {
    TreeNode* node = root;
    while (true) {
        if (p->val < node->val && q->val < node->val) {
            // both smaller: the split is on the left
            node = node->left;
        } else if (p->val > node->val && q->val > node->val) {
            // both larger: the split is on the right
            node = node->right;
        } else {
            // they split here, or one of them is this node
            return node;
        }
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

TreeNode* find(TreeNode* node, int val) {
    while (node && node->val != val)
        node = val < node->val ? node->left : node->right;
    assert(node);
    return node;
}

int lca(const vector<int>& vals, int p, int q) {
    TreeNode* root = build(vals);
    return lowestCommonAncestor(root, find(root, p), find(root, q))->val;
}

int main() {
    vector<int> t = {6, 2, 8, 0, 4, 7, 9, N, N, 3, 5};
    assert(lca(t, 2, 8) == 6);
    // one node is an ancestor of the other
    assert(lca(t, 2, 4) == 2);
    assert(lca(t, 3, 5) == 4);
    assert(lca(t, 7, 9) == 8);
    // p and q given larger first
    assert(lca(t, 5, 0) == 2);
    assert(lca({2, 1}, 2, 1) == 2);
    assert(lca({1}, 1, 1) == 1);
    return 0;
}
