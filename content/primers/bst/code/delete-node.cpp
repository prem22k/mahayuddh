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
// returns the root of this subtree after the delete
TreeNode* deleteNode(TreeNode* root, int key) {
    if (!root) return nullptr;
    if (key < root->val) {
        // go one way and re-attach what comes back
        root->left = deleteNode(root->left, key);
    } else if (key > root->val) {
        root->right = deleteNode(root->right, key);
    } else if (!root->left) {
        // found it, with at most one child: lift that child
        return root->right;
    } else if (!root->right) {
        return root->left;
    } else {
        // two children: copy the next larger value up,
        // then delete that value from the right subtree
        TreeNode* succ = root->right;
        while (succ->left) succ = succ->left;
        root->val = succ->val;
        root->right = deleteNode(root->right, succ->val);
    }
    return root;
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

void inorder(TreeNode* node, vector<int>& out) {
    if (!node) return;
    inorder(node->left, out);
    out.push_back(node->val);
    inorder(node->right, out);
}

bool valid(TreeNode* node, long long lo, long long hi) {
    if (!node) return true;
    return lo < node->val && node->val < hi && valid(node->left, lo, node->val)
        && valid(node->right, node->val, hi);
}

vector<int> after(const vector<int>& vals, int key) {
    TreeNode* root = deleteNode(build(vals), key);
    assert(valid(root, LLONG_MIN, LLONG_MAX));
    vector<int> out;
    inorder(root, out);
    return out;
}

int main() {
    vector<int> t = {5, 3, 6, 2, 4, N, 7};
    // two children: 3 takes its successor's value, 4
    assert((after(t, 3) == vector<int>{2, 4, 5, 6, 7}));
    assert(deleteNode(build(t), 3)->left->val == 4);
    // key not in the tree: nothing changes
    assert((after(t, 0) == vector<int>{2, 3, 4, 5, 6, 7}));
    assert(deleteNode(nullptr, 0) == nullptr);
    // deleting the root
    assert((after(t, 5) == vector<int>{2, 3, 4, 6, 7}));
    // a leaf, and a node with one child
    assert((after(t, 2) == vector<int>{3, 4, 5, 6, 7}));
    assert((after(t, 6) == vector<int>{2, 3, 4, 5, 7}));
    assert(deleteNode(build({1}), 1) == nullptr);
    // the successor has a right child that must be kept
    assert((after({5, 3, 8, N, N, 6, 9, N, 7}, 5) == vector<int>{3, 6, 7, 8, 9}));
    return 0;
}
