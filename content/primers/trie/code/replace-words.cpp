#include <cassert>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

struct TrieNode {
    TrieNode* children[26] = {};
    bool isEnd = false;
};
// ---- code ----
string replaceWords(vector<string>& dictionary,
                    const string& sentence) {
    TrieNode* root = new TrieNode();
    for (const string& word : dictionary) {
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

    string out;
    istringstream words(sentence);
    string word;
    while (words >> word) {
        TrieNode* node = root;
        string replaced = word;
        for (size_t j = 0; j < word.size(); j++) {
            node = node->children[word[j] - 'a'];
            // no root is a prefix of this word
            if (!node) break;
            // the first end mark is the shortest root
            if (node->isEnd) {
                replaced = word.substr(0, j + 1);
                break;
            }
        }
        if (!out.empty()) out += " ";
        out += replaced;
    }
    return out;
}
// ---- checks ----
string run(vector<string> dict, const string& s) { return replaceWords(dict, s); }

int main() {
    assert(run({"cat", "bat", "rat"}, "the cattle was rattled by the battery")
           == "the cat was rat by the bat");
    assert(run({"a", "b", "c"}, "aadsfasf absbs bbab cadsfafs") == "a a b c");
    // the shortest root wins, even if a longer one also fits
    assert(run({"catt", "cat", "ca"}, "cattle") == "ca");
    assert(run({"aa", "a"}, "aaa aa a") == "a a a");
    // a root equal to the whole word, and a word with no root
    assert(run({"cat"}, "cat dog") == "cat dog");
    // a root longer than the word does not apply
    assert(run({"cattle"}, "cat") == "cat");
    return 0;
}
