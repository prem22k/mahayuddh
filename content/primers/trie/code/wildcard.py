from typing import Optional


class TrieNode:
    def __init__(self) -> None:
        self.children: list[Optional[TrieNode]] = [None] * 26
        self.is_end = False
# ---- code ----
class WordDictionary:
    def __init__(self) -> None:
        self.root = TrieNode()

    def addWord(self, word: str) -> None:
        node = self.root
        for c in word:
            i = ord(c) - ord("a")
            if node.children[i] is None:
                node.children[i] = TrieNode()
            node = node.children[i]
        node.is_end = True

    def search(self, word: str) -> bool:
        # can word[i:] be matched starting from node?
        def dfs(node: TrieNode, i: int) -> bool:
            if i == len(word):
                return node.is_end
            if word[i] == ".":
                # "." matches any letter: try every child
                for child in node.children:
                    if child and dfs(child, i + 1):
                        return True
                return False
            child = node.children[ord(word[i]) - ord("a")]
            return child is not None and dfs(child, i + 1)

        return dfs(self.root, 0)
# ---- checks ----
d = WordDictionary()
d.addWord("bad")
d.addWord("dad")
d.addWord("mad")
assert not d.search("pad")
assert d.search("bad")
assert d.search(".ad")
assert d.search("b..")
# the length must match exactly
assert not d.search("b.")
assert not d.search("b...")
assert d.search("...")

# a dot must stand for exactly one letter
e = WordDictionary()
assert not e.search(".")
e.addWord("a")
e.addWord("ab")
assert e.search(".")
assert e.search("a.")
assert not e.search("..b")
# the first branch tried can fail and a later one succeed
e.addWord("xyz")
assert e.search(".yz")
