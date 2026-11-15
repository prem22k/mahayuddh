from typing import Optional


class TrieNode:
    def __init__(self) -> None:
        self.children: list[Optional[TrieNode]] = [None] * 26
        self.is_end = False
# ---- code ----
def replace_words(dictionary: list[str], sentence: str) -> str:
    root = TrieNode()
    for word in dictionary:
        node = root
        for c in word:
            i = ord(c) - ord("a")
            if node.children[i] is None:
                node.children[i] = TrieNode()
            node = node.children[i]
        node.is_end = True

    out: list[str] = []
    for word in sentence.split(" "):
        node = root
        replaced = word
        for j, c in enumerate(word):
            node = node.children[ord(c) - ord("a")]
            # no root is a prefix of this word
            if node is None:
                break
            # the first end mark is the shortest root
            if node.is_end:
                replaced = word[: j + 1]
                break
        out.append(replaced)
    return " ".join(out)
# ---- checks ----
assert (replace_words(["cat", "bat", "rat"],
                      "the cattle was rattled by the battery")
        == "the cat was rat by the bat")
assert (replace_words(["a", "b", "c"], "aadsfasf absbs bbab cadsfafs")
        == "a a b c")
# the shortest root wins, even if a longer one also fits
assert replace_words(["catt", "cat", "ca"], "cattle") == "ca"
assert replace_words(["aa", "a"], "aaa aa a") == "a a a"
# a root equal to the whole word, and a word with no root
assert replace_words(["cat"], "cat dog") == "cat dog"
# a root longer than the word does not apply
assert replace_words(["cattle"], "cat") == "cat"
