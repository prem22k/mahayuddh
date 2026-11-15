#include <cassert>
#include <string>
using namespace std;

struct TrieNode {
    TrieNode* children[26] = {};
    bool isEnd = false;
};
// ---- code ----
class WordDictionary {
public:
    TrieNode* root = new TrieNode();

    void addWord(const string& word) {
        TrieNode* node = root;
        for (char c : word) {
            int i = c - 'a';
            if (!node->children[i]) {
                node->children[i] = new TrieNode();
            }
            node = node->children[i];
        }
        node->isEnd = true;
    }

    bool search(const string& word) {
        return dfs(word, root, 0);
    }

    // can word[i:] be matched starting from node?
    bool dfs(const string& word, TrieNode* node, size_t i) {
        if (i == word.size()) return node->isEnd;
        if (word[i] == '.') {
            // "." matches any letter: try every child
            for (TrieNode* child : node->children) {
                if (child && dfs(word, child, i + 1)) {
                    return true;
                }
            }
            return false;
        }
        TrieNode* child = node->children[word[i] - 'a'];
        return child && dfs(word, child, i + 1);
    }
};
// ---- checks ----
int main() {
    WordDictionary d;
    d.addWord("bad");
    d.addWord("dad");
    d.addWord("mad");
    assert(!d.search("pad"));
    assert(d.search("bad"));
    assert(d.search(".ad"));
    assert(d.search("b.."));
    // the length must match exactly
    assert(!d.search("b."));
    assert(!d.search("b..."));
    assert(d.search("..."));

    // a dot must stand for exactly one letter
    WordDictionary e;
    assert(!e.search("."));
    e.addWord("a");
    e.addWord("ab");
    assert(e.search("."));
    assert(e.search("a."));
    assert(!e.search("..b"));
    // the first branch tried can fail and a later one succeed
    e.addWord("xyz");
    assert(e.search(".yz"));
    return 0;
}
