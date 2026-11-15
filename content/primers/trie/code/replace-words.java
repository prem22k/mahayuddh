import java.util.*;

class TrieNode {
    TrieNode[] children = new TrieNode[26];
    boolean isEnd = false;
}
// ---- code ----
class Solution {
    public String replaceWords(List<String> dictionary,
                               String sentence) {
        TrieNode root = new TrieNode();
        for (String word : dictionary) {
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

        List<String> out = new ArrayList<>();
        for (String word : sentence.split(" ")) {
            TrieNode node = root;
            String replaced = word;
            for (int j = 0; j < word.length(); j++) {
                node = node.children[word.charAt(j) - 'a'];
                // no root is a prefix of this word
                if (node == null) break;
                // the first end mark is the shortest root
                if (node.isEnd) {
                    replaced = word.substring(0, j + 1);
                    break;
                }
            }
            out.add(replaced);
        }
        return String.join(" ", out);
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static String run(String s, String... dict) {
        return new Solution().replaceWords(Arrays.asList(dict), s);
    }

    public static void main(String[] args) {
        check(run("the cattle was rattled by the battery", "cat", "bat", "rat")
              .equals("the cat was rat by the bat"), "example 1");
        check(run("aadsfasf absbs bbab cadsfafs", "a", "b", "c").equals("a a b c"), "example 2");
        // the shortest root wins, even if a longer one also fits
        check(run("cattle", "catt", "cat", "ca").equals("ca"), "shortest");
        check(run("aaa aa a", "aa", "a").equals("a a a"), "nested roots");
        // a root equal to the whole word, and a word with no root
        check(run("cat dog", "cat").equals("cat dog"), "whole word");
        // a root longer than the word does not apply
        check(run("cat", "cattle").equals("cat"), "longer root");
    }
}
