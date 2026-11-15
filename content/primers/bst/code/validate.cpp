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
// every value in this subtree must be inside (lo, hi)
bool check(TreeNode* node, long long lo, long long hi) {
    if (!node) return true;
    if (node->val <= lo || node->val >= hi) return false;
    // left: below this node; right: above it
    return check(node->left, lo, node->val)
        && check(node->right, node->val, hi);
}

bool isValidBST(TreeNode* root) {
    return check(root, LLONG_MIN, LLONG_MAX);
}
// ---- checks ----
const long long N = LLONG_MIN;  // a missing child in build()

TreeNode* build(const vector<long long>& vals) {
    if (vals.empty() || vals[0] == N) return nullptr;
    TreeNode* root = new TreeNode((int)vals[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < vals.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < vals.size() && vals[i] != N) {
            node->left = new TreeNode((int)vals[i]);
            q.push(node->left);
        }
        ++i;
        if (i < vals.size() && vals[i] != N) {
            node->right = new TreeNode((int)vals[i]);
            q.push(node->right);
        }
        ++i;
    }
    return root;
}

int main() {
    // the walkthrough: 9 is above its parent 6 but not below 8
    assert(!isValidBST(build({8, 4, 12, 2, 6, 10, 14, N, N, 5, 9})));
    assert(isValidBST(build({8, 4, 12, 2, 6, 10, 14, N, N, 5, 7})));
    assert(isValidBST(build({2, 1, 3})));
    assert(!isValidBST(build({5, 1, 4, N, N, 3, 6})));
    assert(isValidBST(build({1})));
    assert(isValidBST(nullptr));
    // equal values are not allowed
    assert(!isValidBST(build({2, 2, 2})));
    // an equal value on the right breaks the rule too
    assert(!isValidBST(build({2, 1, 2})));
    // 3 is below its parent 6 but not above the root 5
    assert(!isValidBST(build({5, 4, 6, N, N, 3, 7})));
    // the int limits themselves are valid values
    assert(isValidBST(build({-2147483648LL, N, 2147483647LL})));
    assert(isValidBST(build({2147483647LL})));
    return 0;
}
