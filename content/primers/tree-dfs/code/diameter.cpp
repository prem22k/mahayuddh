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
// returns the height: nodes on the longest path down
int height(TreeNode* node, int& best) {
    if (!node) return 0;
    int left = height(node->left, best);
    int right = height(node->right, best);
    // the longest path that bends at this node, in edges
    best = max(best, left + right);
    // the parent only needs the taller side
    return 1 + max(left, right);
}

int diameterOfBinaryTree(TreeNode* root) {
    int best = 0;
    height(root, best);
    return best;
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
    assert(diameterOfBinaryTree(build({1, 2, 3, 4, 5})) == 3);
    assert(diameterOfBinaryTree(build({1, 2})) == 1);
    assert(diameterOfBinaryTree(build({1})) == 0);
    assert(diameterOfBinaryTree(nullptr) == 0);
    // the longest path doesn't pass through the root
    assert(diameterOfBinaryTree(build({1, 2, N, 3, 4, 5, N, N, 6, 7, N, N, 8})) == 6);
    // a straight line of four nodes
    assert(diameterOfBinaryTree(build({1, 2, N, 3, N, 4})) == 3);
    return 0;
}
