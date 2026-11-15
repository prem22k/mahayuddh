import java.util.*;
// ---- code ----
class TrieNode {
    TrieNode[] children = new TrieNode[26];
    // the whole word if one ends here, else ""
    String word = "";
}

class Solution {
    private char[][] board;
    private List<String> found;

    public List<String> findWords(char[][] board,
                                  String[] words) {
        TrieNode root = new TrieNode();
        for (String w : words) {
            TrieNode node = root;
            for (char c : w.toCharArray()) {
                int i = c - 'a';
                if (node.children[i] == null) {
                    node.children[i] = new TrieNode();
                }
                node = node.children[i];
            }
            node.word = w;
        }

        this.board = board;
        found = new ArrayList<>();
        for (int r = 0; r < board.length; r++) {
            for (int c = 0; c < board[0].length; c++) {
                dfs(r, c, root);
            }
        }
        return found;
    }

    private void dfs(int r, int c, TrieNode node) {
        char ch = board[r][c];
        // "#" marks a cell already on this path
        if (ch == '#') return;
        TrieNode child = node.children[ch - 'a'];
        // no word goes this way: stop early
        if (child == null) return;
        if (!child.word.isEmpty()) {
            found.add(child.word);
            // clear it so each word is reported once
            child.word = "";
        }
        board[r][c] = '#';
        int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        for (int[] d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nr < board.length
                    && nc >= 0 && nc < board[0].length) {
                dfs(nr, nc, child);
            }
        }
        // undo the mark so other paths can use this cell
        board[r][c] = ch;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }

    static char[][] grid(String... rows) {
        char[][] g = new char[rows.length][];
        for (int i = 0; i < rows.length; i++) g[i] = rows[i].toCharArray();
        return g;
    }

    static List<String> run(char[][] board, String... words) {
        List<String> got = new ArrayList<>(new Solution().findWords(board, words));
        Collections.sort(got);
        return got;
    }

    public static void main(String[] args) {
        char[][] b = grid("oaan", "etae", "ihkr", "iflv");
        check(run(b, "oath", "pea", "eat", "rain").equals(List.of("eat", "oath")), "example 1");
        // the board is restored after the search
        check(Arrays.deepEquals(b, grid("oaan", "etae", "ihkr", "iflv")), "board restored");
        check(run(grid("ab", "cd"), "abcb").isEmpty(), "example 2");
        // a cell can't be used twice in one word
        check(run(grid("aa"), "aa", "a", "aaa").equals(List.of("a", "aa")), "no reuse");
        // many paths spell "ab", but it is reported once
        check(run(grid("ab", "ba"), "ab").equals(List.of("ab")), "once");
        check(run(grid("a"), "a", "b").equals(List.of("a")), "single cell");
        // words that share a prefix are all found
        check(run(grid("cat", "xrx"), "cat", "car", "ca", "cab").equals(List.of("ca", "car", "cat")), "shared prefix");
    }
}
