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
void dfs(TreeNode* node, int remaining, vector<int>& path,
         vector<vector<int>>& out) {
    if (!node) return;
    // on the way down: this node joins the path
    path.push_back(node->val);
    remaining -= node->val;
    // a leaf that uses up the target exactly
    if (!node->left && !node->right && remaining == 0) {
        out.push_back(path);
    }
    dfs(node->left, remaining, path, out);
    dfs(node->right, remaining, path, out);
    // on the way up: undo, so the path is clean again
    path.pop_back();
}

vector<vector<int>> pathSum(TreeNode* root, int target) {
    vector<vector<int>> out;
    vector<int> path;
    dfs(root, target, path, out);
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
    TreeNode* t = build({5, 4, 8, 11, N, 13, 4, 7, 2, N, N, 5, 1});
    assert((pathSum(t, 22) == VV{{5, 4, 11, 2}, {5, 8, 4, 5}}));
    assert((pathSum(build({1, 2, 3}), 5) == VV{}));
    assert((pathSum(build({1, 2}), 0) == VV{}));
    assert((pathSum(nullptr, 0) == VV{}));
    // a node with one child is not a leaf
    assert((pathSum(build({1, 2}), 1) == VV{}));
    // negative values: the sum can dip and come back
    assert((pathSum(build({-2, N, -3}), -5) == VV{{-2, -3}}));
    assert((pathSum(build({1, -1, -1, 1, N, 1}), 1) == VV{{1, -1, 1}, {1, -1, 1}}));
    return 0;
}
