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
    // returns p, q, their LCA, or null if neither is below
    if (!root || root == p || root == q) return root;
    TreeNode* left = lowestCommonAncestor(root->left, p, q);
    TreeNode* right = lowestCommonAncestor(root->right, p, q);
    // one found on each side: they meet here
    if (left && right) return root;
    // otherwise pass up whatever was found
    return left ? left : right;
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

TreeNode* find(TreeNode* root, int val) {
    if (!root || root->val == val) return root;
    TreeNode* l = find(root->left, val);
    return l ? l : find(root->right, val);
}

int lca(const vector<int>& vals, int p, int q) {
    TreeNode* root = build(vals);
    return lowestCommonAncestor(root, find(root, p), find(root, q))->val;
}

int main() {
    vector<int> t = {3, 5, 1, 6, 2, 0, 8, N, N, 7, 4};
    assert(lca(t, 5, 1) == 3);
    // a node is its own ancestor
    assert(lca(t, 5, 4) == 5);
    assert(lca(t, 7, 4) == 2);
    assert(lca(t, 6, 4) == 5);
    assert(lca({1, 2}, 1, 2) == 1);
    // both deep on the same side, far from the root
    assert(lca(t, 7, 6) == 5);
    return 0;
}
