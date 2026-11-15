import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "trie",
  pattern: "Trie",
  title: "Trie",
  order: 15,
  prerequisites: ["tree-dfs"],
  summary:
    "A tree of letters where each root-to-node path spells a prefix, so words that start the same way share nodes. It answers \"is this a word?\" and \"does any word start with this?\" in time proportional to the word's length, however many words are stored.",

  recognizeWhen: [
    "Many words, and many questions about their prefixes: starts with, autocomplete, shortest root.",
    "You check a string letter by letter against a whole dictionary, and want to stop the moment no word can match.",
    "A search over a grid or a stream must match any of a list of words at once.",
    "A design problem asks for insert, search and startsWith (or a wildcard like \".\").",
    "Maximum XOR of two numbers: a trie over bits, highest bit first.",
  ],

  coreIdea: `Each node stands for one prefix. It has up to 26 children, one per next letter, and a flag that says whether a whole word ends here. The root is the empty prefix. To insert a word, walk from the root one letter at a time, creating any child that is missing, and set the flag on the last node.

To look something up, walk the same way. If a child is missing, no stored word has that prefix, and you stop. If the walk finishes, the prefix exists; it is a whole word only if the last node's flag is set. That flag is the difference between search("app") and startsWith("app") after inserting "apple".

It's fast because the cost depends on the length of the string, not on how many words are stored. A hash set can also check a whole word in O(L), but it can't tell you that no word starts with "xq" without scanning everything. The trie can, and that is what lets a search give up early.

The price is memory: one node per distinct prefix, each with 26 slots. When the alphabet is large or unknown, use a hash map for the children instead of an array. For a single lookup, or when no prefix question is asked, a hash set is simpler.`,

  walkthrough: {
    problemSlug: "implement-trie-prefix-tree",
    input: "insert(\"cat\"), insert(\"car\"), search(\"ca\"), startsWith(\"ca\"), insert(\"ca\"), search(\"ca\"), search(\"cab\")",
    intro: "one step per call. A * marks a node whose end-of-word flag is set.",
    columns: ["Trie paths", "Call", "Returns"],
    steps: [
      { window: "c → a → t*", action: "insert(\"cat\"): no children yet, so create c, a and t; flag t", best: "null" },
      { window: "c → a → {t*, r*}", action: "insert(\"car\"): c and a exist; create r under a and flag it", best: "null" },
      { window: "c → a → {t*, r*}", action: "search(\"ca\"): the walk reaches a, but a has no flag", best: "false" },
      { window: "c → a → {t*, r*}", action: "startsWith(\"ca\"): the walk reaches a, so the prefix exists", best: "true" },
      { window: "c → a* → {t*, r*}", action: "insert(\"ca\"): both nodes exist; nothing is created, a gets its flag", best: "null" },
      { window: "c → a* → {t*, r*}", action: "search(\"ca\"): the walk reaches a, and now it is flagged", best: "true" },
      { window: "c → a* → {t*, r*}", action: "search(\"cab\"): a has no b child, so the walk stops", best: "false" },
    ],
    result: "false, true, true, false for the four lookups. Three words share the nodes c and a; only the flag tells \"ca\" the word from \"ca\" the prefix.",
  },

  template: {
    code: "trie",
    note: "insert creates missing children and flags the last node. search and startsWith share one walk that returns the last node or null; search also checks the flag.",
  },

  variants: [
    {
      name: "Wildcards: branch on \".\"",
      when: "A query letter can match anything, like \".\" in \"b..\".",
      idea:
        "Make the walk a DFS over (node, index). A normal letter follows its one child. A \".\" tries every child that exists and succeeds if any branch does. At the end of the query, the answer is the node's flag.",
      code: "wildcard",
      problemSlug: "design-add-and-search-words-data-structure",
    },
    {
      name: "Stop at the first flag",
      when: "You want the shortest stored word that is a prefix of the input.",
      idea:
        "Build the trie from the dictionary, then walk each word of the sentence. The first flagged node on the walk is the shortest root, so cut the word there. A missing child means no root fits, and the word stays as it is.",
      code: "replace-words",
      problemSlug: "replace-words",
    },
    {
      name: "Walk the trie and the grid together",
      when: "Find which of many words can be traced on a grid.",
      idea:
        "Run one backtracking DFS from each cell, moving down the trie as you move across the grid. When the grid letter has no child in the trie, no word continues that way, so stop. Store the word at its end node and clear it once found, so it is reported once.",
      code: "word-search-ii",
      problemSlug: "word-search-ii",
    },
  ],

  complexity: {
    time: "O(L) per insert or lookup, where L is the length of the string",
    space: "O(total letters inserted × 26) in the worst case",
    why: "Each letter moves one level down the trie with one array lookup, so the work depends only on the string being processed. Every new letter can create a node with 26 slots, which is where the memory goes. A wildcard query can visit many branches, up to every node in the trie.",
  },

  mistakes: [
    "Forgetting the end-of-word flag, so search(\"app\") returns true after inserting only \"apple\".",
    "Writing search and startsWith as two separate walks. They are the same walk; only the last check differs.",
    "Creating nodes during a search. Only insert should add nodes, or lookups slowly fill the trie.",
    "Indexing with c - 'a' when the input can hold uppercase letters or other symbols. Use a hash map for the children then.",
    "In Word Search II, not marking the cell as used while it is on the path, so a letter gets used twice in one word.",
    "Reporting the same word twice when several grid paths spell it. Clear the stored word once it's found.",
    "Using a trie for one lookup in a list of words. A hash set does that with less code.",
  ],

  notThis: [
    "You only check whole words, never prefixes: use a hash set. See Arrays & Hashing.",
    "Searching for one pattern inside one long text: use string matching (KMP, or a rolling hash), not a trie of one word.",
    "Words in sorted order with a prefix question asked once: sort and binary search for the first word >= the prefix. See Binary Search.",
  ],

  ladder: [
    { slug: "implement-trie-prefix-tree", tier: "warm-up", note: "The template: insert, search and startsWith on one walk." },
    { slug: "longest-common-prefix", tier: "warm-up", note: "Insert every word, then walk down while there is exactly one child and no word has ended." },
    { slug: "longest-word-in-dictionary", tier: "warm-up", note: "Every prefix must also be a word: only step through flagged nodes." },
    { slug: "replace-words", tier: "core", note: "Stop at the first flag on the walk: the shortest root." },
    { slug: "design-add-and-search-words-data-structure", tier: "core", note: "A \".\" tries every child: the walk becomes a DFS." },
    { slug: "map-sum-pairs", tier: "core", note: "Keep a sum at every node on the path and fix it up when a key's value changes." },
    { slug: "search-suggestions-system", tier: "core", note: "One step down per typed letter, then list the first three words below that node." },
    { slug: "maximum-xor-of-two-numbers-in-an-array", tier: "core", note: "A trie over bits, top bit first: take the opposite bit whenever it exists." },
    { slug: "word-search-ii", tier: "stretch", note: "Backtrack on the grid and the trie at once, and prune where no word continues." },
    { slug: "sum-of-prefix-scores-of-strings", tier: "stretch", note: "Count the words that pass through each node; a word's score is the sum along its path." },
    { slug: "stream-of-characters", tier: "stretch", note: "Insert the words reversed and walk back from the newest letter." },
  ],
};
