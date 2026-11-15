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
vector<vector<int>> levelOrder(TreeNode* root) {
    vector<vector<int>> out;
    if (!root) return out;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        vector<int> level;
        // everything in the queue right now is one level
        int size = q.size();
        for (int i = 0; i < size; ++i) {
            TreeNode* node = q.front();
            q.pop();
            level.push_back(node->val);
            // children wait behind the rest of this level
            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
        out.push_back(level);
    }
    return out;
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

using VV = vector<vector<int>>;
int main() {
    assert((levelOrder(build({3, 9, 20, N, N, 15, 7})) == VV{{3}, {9, 20}, {15, 7}}));
    assert((levelOrder(build({1})) == VV{{1}}));
    assert((levelOrder(nullptr) == VV{}));
    // a gap in the middle level must not shift the next one
    assert((levelOrder(build({1, 2, 3, N, 4, 5, N, 6})) == VV{{1}, {2, 3}, {4, 5}, {6}}));
    // a chain: one node per level
    assert((levelOrder(build({1, N, 2, N, 3})) == VV{{1}, {2}, {3}}));
    return 0;
}
