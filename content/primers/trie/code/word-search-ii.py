from typing import Optional
# ---- code ----
class TrieNode:
    def __init__(self) -> None:
        self.children: list[Optional[TrieNode]] = [None] * 26
        # the whole word if one ends here, else ""
        self.word = ""


def find_words(board: list[list[str]],
               words: list[str]) -> list[str]:
    root = TrieNode()
    for w in words:
        node = root
        for c in w:
            i = ord(c) - ord("a")
            if node.children[i] is None:
                node.children[i] = TrieNode()
            node = node.children[i]
        node.word = w

    rows, cols = len(board), len(board[0])
    found: list[str] = []

    def dfs(r: int, c: int, node: TrieNode) -> None:
        ch = board[r][c]
        # "#" marks a cell already on this path
        if ch == "#":
            return
        child = node.children[ord(ch) - ord("a")]
        # no word goes this way: stop early
        if child is None:
            return
        if child.word:
            found.append(child.word)
            # clear it so each word is reported once
            child.word = ""
        board[r][c] = "#"
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                dfs(nr, nc, child)
        # undo the mark so other paths can use this cell
        board[r][c] = ch

    for r in range(rows):
        for c in range(cols):
            dfs(r, c, root)
    return found
# ---- checks ----
def grid(*rows: str) -> list[list[str]]:
    return [list(r) for r in rows]


def run(board: list[list[str]], words: list[str]) -> list[str]:
    return sorted(find_words(board, words))


B = grid("oaan", "etae", "ihkr", "iflv")
assert run(B, ["oath", "pea", "eat", "rain"]) == ["eat", "oath"]
# the board is restored after the search
assert B == grid("oaan", "etae", "ihkr", "iflv")
assert run(grid("ab", "cd"), ["abcb"]) == []
# a cell can't be used twice in one word
assert run(grid("aa"), ["aa", "a", "aaa"]) == ["a", "aa"]
# many paths spell "ab", but it is reported once
assert run(grid("ab", "ba"), ["ab"]) == ["ab"]
assert run(grid("a"), ["a", "b"]) == ["a"]
# words that share a prefix are all found
assert run(grid("cat", "xrx"), ["cat", "car", "ca", "cab"]) == [
    "ca", "car", "cat"]
