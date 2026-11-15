import java.util.*;

class TrieNode {
    TrieNode[] children = new TrieNode[26];
    boolean isEnd = false;
}
// ---- code ----
class WordDictionary {
    private final TrieNode root = new TrieNode();

    public void addWord(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) {
                node.children[i] = new TrieNode();
            }
            node = node.children[i];
        }
        node.isEnd = true;
    }

    public boolean search(String word) {
        return dfs(word, root, 0);
    }

    // can word[i:] be matched starting from node?
    private boolean dfs(String word, TrieNode node, int i) {
        if (i == word.length()) return node.isEnd;
        if (word.charAt(i) == '.') {
            // "." matches any letter: try every child
            for (TrieNode child : node.children) {
                if (child != null && dfs(word, child, i + 1)) {
                    return true;
                }
            }
            return false;
        }
        TrieNode child = node.children[word.charAt(i) - 'a'];
        return child != null && dfs(word, child, i + 1);
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        WordDictionary d = new WordDictionary();
        d.addWord("bad");
        d.addWord("dad");
        d.addWord("mad");
        check(!d.search("pad"), "pad");
        check(d.search("bad"), "bad");
        check(d.search(".ad"), ".ad");
        check(d.search("b.."), "b..");
        // the length must match exactly
        check(!d.search("b."), "b.");
        check(!d.search("b..."), "b...");
        check(d.search("..."), "...");

        // a dot must stand for exactly one letter
        WordDictionary e = new WordDictionary();
        check(!e.search("."), "empty dot");
        e.addWord("a");
        e.addWord("ab");
        check(e.search("."), "dot");
        check(e.search("a."), "a.");
        check(!e.search("..b"), "..b");
        // the first branch tried can fail and a later one succeed
        e.addWord("xyz");
        check(e.search(".yz"), ".yz");
    }
}
