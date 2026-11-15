#include <algorithm>
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
// topMax: the largest value on the path from the root
int dfs(TreeNode* node, int topMax) {
    if (!node) return 0;
    int good = node->val >= topMax ? 1 : 0;
    // hand each child the max of the path so far
    topMax = max(topMax, node->val);
    int left = dfs(node->left, topMax);
    int right = dfs(node->right, topMax);
    return good + left + right;
}

int goodNodes(TreeNode* root) {
    return dfs(root, root->val);
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
    assert(goodNodes(build({3, 1, 4, 3, N, 1, 5})) == 4);
    assert(goodNodes(build({3, 3, N, 4, 2})) == 3);
    assert(goodNodes(build({1})) == 1);
    // the max must not leak from one branch into the other
    assert(goodNodes(build({2, 9, 3, N, N, 4, 1})) == 4);
    assert(goodNodes(build({-1, -2, -1})) == 2);
    return 0;
}
