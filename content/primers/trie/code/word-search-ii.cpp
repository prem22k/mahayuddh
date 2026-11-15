#include <algorithm>
#include <cassert>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
struct TrieNode {
    TrieNode* children[26] = {};
    // the whole word if one ends here, else ""
    string word;
};

void dfs(vector<vector<char>>& board, int r, int c,
         TrieNode* node, vector<string>& found) {
    char ch = board[r][c];
    // "#" marks a cell already on this path
    if (ch == '#') return;
    TrieNode* child = node->children[ch - 'a'];
    // no word goes this way: stop early
    if (!child) return;
    if (!child->word.empty()) {
        found.push_back(child->word);
        // clear it so each word is reported once
        child->word = "";
    }
    board[r][c] = '#';
    int rows = board.size(), cols = board[0].size();
    int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
    for (int d = 0; d < 4; d++) {
        int nr = r + dr[d], nc = c + dc[d];
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            dfs(board, nr, nc, child, found);
        }
    }
    // undo the mark so other paths can use this cell
    board[r][c] = ch;
}

vector<string> findWords(vector<vector<char>>& board,
                         vector<string>& words) {
    TrieNode* root = new TrieNode();
    for (const string& w : words) {
        TrieNode* node = root;
        for (char c : w) {
            int i = c - 'a';
            if (!node->children[i]) {
                node->children[i] = new TrieNode();
            }
            node = node->children[i];
        }
        node->word = w;
    }

    int rows = board.size(), cols = board[0].size();
    vector<string> found;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            dfs(board, r, c, root, found);
        }
    }
    return found;
}
// ---- checks ----
vector<vector<char>> grid(const vector<string>& rows) {
    vector<vector<char>> g;
    for (const string& r : rows) g.push_back(vector<char>(r.begin(), r.end()));
    return g;
}

vector<string> run(vector<vector<char>> board, vector<string> words) {
    vector<string> got = findWords(board, words);
    sort(got.begin(), got.end());
    return got;
}

int main() {
    vector<vector<char>> b = grid({"oaan", "etae", "ihkr", "iflv"});
    vector<string> w = {"oath", "pea", "eat", "rain"};
    assert((findWords(b, w).size() == 2));
    // the board is restored after the search
    assert(b == grid({"oaan", "etae", "ihkr", "iflv"}));
    assert((run(b, {"oath", "pea", "eat", "rain"}) == vector<string>{"eat", "oath"}));
    assert(run(grid({"ab", "cd"}), {"abcb"}).empty());
    // a cell can't be used twice in one word
    assert((run(grid({"aa"}), {"aa", "a", "aaa"}) == vector<string>{"a", "aa"}));
    // many paths spell "ab", but it is reported once
    assert((run(grid({"ab", "ba"}), {"ab"}) == vector<string>{"ab"}));
    assert((run(grid({"a"}), {"a", "b"}) == vector<string>{"a"}));
    // words that share a prefix are all found
    assert((run(grid({"cat", "xrx"}), {"cat", "car", "ca", "cab"})
            == vector<string>{"ca", "car", "cat"}));
    return 0;
}
