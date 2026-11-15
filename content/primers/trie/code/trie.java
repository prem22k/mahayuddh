import java.util.*;
// ---- code ----
class TrieNode {
    // one slot per letter a..z
    TrieNode[] children = new TrieNode[26];
    boolean isEnd = false;
}

class Trie {
    private final TrieNode root = new TrieNode();

    public void insert(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            // make the path if it isn't there yet
            if (node.children[i] == null) {
                node.children[i] = new TrieNode();
            }
            node = node.children[i];
        }
        // mark that a whole word ends here
        node.isEnd = true;
    }

    // the node at the end of the path, or null
    private TrieNode walk(String s) {
        TrieNode node = root;
        for (char c : s.toCharArray()) {
            node = node.children[c - 'a'];
            if (node == null) return null;
        }
        return node;
    }

    public boolean search(String word) {
        TrieNode node = walk(word);
        return node != null && node.isEnd;
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    public static void main(String[] args) {
        // the walkthrough
        Trie t = new Trie();
        t.insert("cat");
        t.insert("car");
        check(!t.search("ca"), "ca is only a prefix");
        check(t.startsWith("ca"), "prefix ca");
        t.insert("ca");
        check(t.search("ca"), "ca is a word now");
        check(!t.search("cab"), "cab");
        check(t.search("cat") && t.search("car"), "cat, car");

        // the LeetCode example
        Trie a = new Trie();
        a.insert("apple");
        check(a.search("apple"), "apple");
        check(!a.search("app"), "app before insert");
        check(a.startsWith("app"), "prefix app");
        a.insert("app");
        check(a.search("app"), "app after insert");

        // an empty trie, and a prefix longer than any word
        Trie e = new Trie();
        check(!e.search("a"), "empty search");
        check(!e.startsWith("a"), "empty prefix");
        e.insert("a");
        check(e.search("a") && e.startsWith("a"), "a");
        check(!e.startsWith("ab"), "longer prefix");
        // inserting twice changes nothing
        e.insert("a");
        check(e.search("a"), "twice");
    }
}
