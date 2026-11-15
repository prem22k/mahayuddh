from typing import Optional
# ---- code ----
class TrieNode:
    def __init__(self) -> None:
        # one slot per letter a..z
        self.children: list[Optional[TrieNode]] = [None] * 26
        self.is_end = False


class Trie:
    def __init__(self) -> None:
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for c in word:
            i = ord(c) - ord("a")
            # make the path if it isn't there yet
            if node.children[i] is None:
                node.children[i] = TrieNode()
            node = node.children[i]
        # mark that a whole word ends here
        node.is_end = True

    # the node at the end of the path, or None
    def walk(self, s: str) -> Optional[TrieNode]:
        node = self.root
        for c in s:
            node = node.children[ord(c) - ord("a")]
            if node is None:
                return None
        return node

    def search(self, word: str) -> bool:
        node = self.walk(word)
        return node is not None and node.is_end

    def startsWith(self, prefix: str) -> bool:
        return self.walk(prefix) is not None
# ---- checks ----
# the walkthrough
t = Trie()
t.insert("cat")
t.insert("car")
assert t.search("ca") is False
assert t.startsWith("ca") is True
t.insert("ca")
assert t.search("ca") is True
assert t.search("cab") is False
assert t.search("cat") and t.search("car")

# the LeetCode example
t = Trie()
t.insert("apple")
assert t.search("apple")
assert not t.search("app")
assert t.startsWith("app")
t.insert("app")
assert t.search("app")

# an empty trie, and a prefix longer than any word
t = Trie()
assert not t.search("a")
assert not t.startsWith("a")
t.insert("a")
assert t.search("a") and t.startsWith("a")
assert not t.startsWith("ab")
# inserting twice changes nothing
t.insert("a")
assert t.search("a")
