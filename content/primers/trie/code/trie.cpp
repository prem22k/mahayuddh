#include <cassert>
#include <string>
using namespace std;
// ---- code ----
struct TrieNode {
    // one slot per letter a..z
    TrieNode* children[26] = {};
    bool isEnd = false;
};

class Trie {
public:
    TrieNode* root = new TrieNode();

    void insert(const string& word) {
        TrieNode* node = root;
        for (char c : word) {
            int i = c - 'a';
            // make the path if it isn't there yet
            if (!node->children[i]) {
                node->children[i] = new TrieNode();
            }
            node = node->children[i];
        }
        // mark that a whole word ends here
        node->isEnd = true;
    }

    // the node at the end of the path, or nullptr
    TrieNode* walk(const string& s) {
        TrieNode* node = root;
        for (char c : s) {
            node = node->children[c - 'a'];
            if (!node) return nullptr;
        }
        return node;
    }

    bool search(const string& word) {
        TrieNode* node = walk(word);
        return node && node->isEnd;
    }

    bool startsWith(const string& prefix) {
        return walk(prefix) != nullptr;
    }
};
// ---- checks ----
int main() {
    // the walkthrough
    Trie t;
    t.insert("cat");
    t.insert("car");
    assert(!t.search("ca"));
    assert(t.startsWith("ca"));
    t.insert("ca");
    assert(t.search("ca"));
    assert(!t.search("cab"));
    assert(t.search("cat") && t.search("car"));

    // the LeetCode example
    Trie a;
    a.insert("apple");
    assert(a.search("apple"));
    assert(!a.search("app"));
    assert(a.startsWith("app"));
    a.insert("app");
    assert(a.search("app"));

    // an empty trie, and a prefix longer than any word
    Trie e;
    assert(!e.search("a"));
    assert(!e.startsWith("a"));
    e.insert("a");
    assert(e.search("a") && e.startsWith("a"));
    assert(!e.startsWith("ab"));
    // inserting twice changes nothing
    e.insert("a");
    assert(e.search("a"));
    return 0;
}
