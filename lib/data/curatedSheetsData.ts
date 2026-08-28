export type Difficulty = "Easy" | "Medium" | "Hard";

export interface CuratedSheetProblem {
  title: string;
  title_slug: string;
  difficulty: Difficulty;
  category: string;
  order_index: number;
}

export interface CuratedSheet {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  problems: CuratedSheetProblem[];
}

export const BLIND_75_PROBLEMS: CuratedSheetProblem[] = [
  // Arrays & Hashing
  { title: "Two Sum", title_slug: "two-sum", difficulty: "Easy", category: "Arrays & Hashing", order_index: 1 },
  { title: "Contains Duplicate", title_slug: "contains-duplicate", difficulty: "Easy", category: "Arrays & Hashing", order_index: 2 },
  { title: "Valid Anagram", title_slug: "valid-anagram", difficulty: "Easy", category: "Arrays & Hashing", order_index: 3 },
  { title: "Group Anagrams", title_slug: "group-anagrams", difficulty: "Medium", category: "Arrays & Hashing", order_index: 4 },
  { title: "Top K Frequent Elements", title_slug: "top-k-frequent-elements", difficulty: "Medium", category: "Arrays & Hashing", order_index: 5 },
  { title: "Product of Array Except Self", title_slug: "product-of-array-except-self", difficulty: "Medium", category: "Arrays & Hashing", order_index: 6 },
  { title: "Encode and Decode Strings", title_slug: "encode-and-decode-strings", difficulty: "Medium", category: "Arrays & Hashing", order_index: 7 },
  { title: "Longest Consecutive Sequence", title_slug: "longest-consecutive-sequence", difficulty: "Medium", category: "Arrays & Hashing", order_index: 8 },

  // Two Pointers
  { title: "Valid Palindrome", title_slug: "valid-palindrome", difficulty: "Easy", category: "Two Pointers", order_index: 9 },
  { title: "3Sum", title_slug: "3sum", difficulty: "Medium", category: "Two Pointers", order_index: 10 },
  { title: "Container With Most Water", title_slug: "container-with-most-water", difficulty: "Medium", category: "Two Pointers", order_index: 11 },
  { title: "Trapping Rain Water", title_slug: "trapping-rain-water", difficulty: "Hard", category: "Two Pointers", order_index: 12 },

  // Sliding Window
  { title: "Best Time to Buy and Sell Stock", title_slug: "best-time-to-buy-and-sell-stock", difficulty: "Easy", category: "Sliding Window", order_index: 13 },
  { title: "Longest Substring Without Repeating Characters", title_slug: "longest-substring-without-repeating-characters", difficulty: "Medium", category: "Sliding Window", order_index: 14 },
  { title: "Longest Repeating Character Replacement", title_slug: "longest-repeating-character-replacement", difficulty: "Medium", category: "Sliding Window", order_index: 15 },
  { title: "Minimum Window Substring", title_slug: "minimum-window-substring", difficulty: "Hard", category: "Sliding Window", order_index: 16 },

  // Stack
  { title: "Valid Parentheses", title_slug: "valid-parentheses", difficulty: "Easy", category: "Stack", order_index: 17 },

  // Binary Search
  { title: "Find Minimum in Rotated Sorted Array", title_slug: "find-minimum-in-rotated-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 18 },
  { title: "Search in Rotated Sorted Array", title_slug: "search-in-rotated-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 19 },

  // Linked List
  { title: "Reverse Linked List", title_slug: "reverse-linked-list", difficulty: "Easy", category: "Linked List", order_index: 20 },
  { title: "Merge Two Sorted Lists", title_slug: "merge-two-sorted-lists", difficulty: "Easy", category: "Linked List", order_index: 21 },
  { title: "Reorder List", title_slug: "reorder-list", difficulty: "Medium", category: "Linked List", order_index: 22 },
  { title: "Remove Nth Node From End of List", title_slug: "remove-nth-node-from-end-of-list", difficulty: "Medium", category: "Linked List", order_index: 23 },
  { title: "Linked List Cycle", title_slug: "linked-list-cycle", difficulty: "Easy", category: "Linked List", order_index: 24 },
  { title: "Merge k Sorted Lists", title_slug: "merge-k-sorted-lists", difficulty: "Hard", category: "Linked List", order_index: 25 },

  // Trees
  { title: "Invert Binary Tree", title_slug: "invert-binary-tree", difficulty: "Easy", category: "Trees", order_index: 26 },
  { title: "Maximum Depth of Binary Tree", title_slug: "maximum-depth-of-binary-tree", difficulty: "Easy", category: "Trees", order_index: 27 },
  { title: "Same Tree", title_slug: "same-tree", difficulty: "Easy", category: "Trees", order_index: 28 },
  { title: "Subtree of Another Tree", title_slug: "subtree-of-another-tree", difficulty: "Easy", category: "Trees", order_index: 29 },
  { title: "Lowest Common Ancestor of a BST", title_slug: "lowest-common-ancestor-of-a-binary-search-tree", difficulty: "Medium", category: "Trees", order_index: 30 },
  { title: "Binary Tree Level Order Traversal", title_slug: "binary-tree-level-order-traversal", difficulty: "Medium", category: "Trees", order_index: 31 },
  { title: "Validate Binary Search Tree", title_slug: "validate-binary-search-tree", difficulty: "Medium", category: "Trees", order_index: 32 },
  { title: "Kth Smallest Element in a BST", title_slug: "kth-smallest-element-in-a-bst", difficulty: "Medium", category: "Trees", order_index: 33 },
  { title: "Construct Binary Tree from Preorder and Inorder Traversal", title_slug: "construct-binary-tree-from-preorder-and-inorder-traversal", difficulty: "Medium", category: "Trees", order_index: 34 },
  { title: "Binary Tree Maximum Path Sum", title_slug: "binary-tree-maximum-path-sum", difficulty: "Hard", category: "Trees", order_index: 35 },
  { title: "Serialize and Deserialize Binary Tree", title_slug: "serialize-and-deserialize-binary-tree", difficulty: "Hard", category: "Trees", order_index: 36 },

  // Tries
  { title: "Implement Trie Prefix Tree", title_slug: "implement-trie-prefix-tree", difficulty: "Medium", category: "Tries", order_index: 37 },
  { title: "Design Add and Search Words Data Structure", title_slug: "design-add-and-search-words-data-structure", difficulty: "Medium", category: "Tries", order_index: 38 },
  { title: "Word Search II", title_slug: "word-search-ii", difficulty: "Hard", category: "Tries", order_index: 39 },

  // Heap / Priority Queue
  { title: "Find Median from Data Stream", title_slug: "find-median-from-data-stream", difficulty: "Hard", category: "Heap", order_index: 40 },

  // Backtracking
  { title: "Combination Sum", title_slug: "combination-sum", difficulty: "Medium", category: "Backtracking", order_index: 41 },
  { title: "Word Search", title_slug: "word-search", difficulty: "Medium", category: "Backtracking", order_index: 42 },

  // Graphs
  { title: "Number of Islands", title_slug: "number-of-islands", difficulty: "Medium", category: "Graphs", order_index: 43 },
  { title: "Clone Graph", title_slug: "clone-graph", difficulty: "Medium", category: "Graphs", order_index: 44 },
  { title: "Pacific Atlantic Water Flow", title_slug: "pacific-atlantic-water-flow", difficulty: "Medium", category: "Graphs", order_index: 45 },
  { title: "Course Schedule", title_slug: "course-schedule", difficulty: "Medium", category: "Graphs", order_index: 46 },
  { title: "Number of Connected Components in an Undirected Graph", title_slug: "number-of-connected-components-in-an-undirected-graph", difficulty: "Medium", category: "Graphs", order_index: 47 },
  { title: "Graph Valid Tree", title_slug: "graph-valid-tree", difficulty: "Medium", category: "Graphs", order_index: 48 },
  { title: "Alien Dictionary", title_slug: "alien-dictionary", difficulty: "Hard", category: "Graphs", order_index: 49 },

  // 1-D Dynamic Programming
  { title: "Climbing Stairs", title_slug: "climbing-stairs", difficulty: "Easy", category: "1-D Dynamic Programming", order_index: 50 },
  { title: "House Robber", title_slug: "house-robber", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 51 },
  { title: "House Robber II", title_slug: "house-robber-ii", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 52 },
  { title: "Longest Palindromic Substring", title_slug: "longest-palindromic-substring", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 53 },
  { title: "Palindromic Substrings", title_slug: "palindromic-substrings", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 54 },
  { title: "Decode Ways", title_slug: "decode-ways", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 55 },
  { title: "Coin Change", title_slug: "coin-change", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 56 },
  { title: "Maximum Product Subarray", title_slug: "maximum-product-subarray", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 57 },
  { title: "Word Break", title_slug: "word-break", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 58 },
  { title: "Longest Increasing Subsequence", title_slug: "longest-increasing-subsequence", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 59 },

  // 2-D Dynamic Programming
  { title: "Unique Paths", title_slug: "unique-paths", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 60 },
  { title: "Longest Common Subsequence", title_slug: "longest-common-subsequence", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 61 },

  // Greedy
  { title: "Maximum Subarray", title_slug: "maximum-subarray", difficulty: "Medium", category: "Greedy", order_index: 62 },
  { title: "Jump Game", title_slug: "jump-game", difficulty: "Medium", category: "Greedy", order_index: 63 },

  // Intervals
  { title: "Insert Interval", title_slug: "insert-interval", difficulty: "Medium", category: "Intervals", order_index: 64 },
  { title: "Merge Intervals", title_slug: "merge-intervals", difficulty: "Medium", category: "Intervals", order_index: 65 },
  { title: "Non-overlapping Intervals", title_slug: "non-overlapping-intervals", difficulty: "Medium", category: "Intervals", order_index: 66 },
  { title: "Meeting Rooms", title_slug: "meeting-rooms", difficulty: "Easy", category: "Intervals", order_index: 67 },
  { title: "Meeting Rooms II", title_slug: "meeting-rooms-ii", difficulty: "Medium", category: "Intervals", order_index: 68 },

  // Math & Geometry
  { title: "Rotate Image", title_slug: "rotate-image", difficulty: "Medium", category: "Math & Geometry", order_index: 69 },
  { title: "Spiral Matrix", title_slug: "spiral-matrix", difficulty: "Medium", category: "Math & Geometry", order_index: 70 },
  { title: "Set Matrix Zeroes", title_slug: "set-matrix-zeroes", difficulty: "Medium", category: "Math & Geometry", order_index: 71 },

  // Bit Manipulation
  { title: "Number of 1 Bits", title_slug: "number-of-1-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 72 },
  { title: "Counting Bits", title_slug: "counting-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 73 },
  { title: "Reverse Bits", title_slug: "reverse-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 74 },
  { title: "Missing Number", title_slug: "missing-number", difficulty: "Easy", category: "Bit Manipulation", order_index: 75 },
];

export const NEETCODE_150_PROBLEMS: CuratedSheetProblem[] = [
  // Arrays & Hashing (9)
  { title: "Contains Duplicate", title_slug: "contains-duplicate", difficulty: "Easy", category: "Arrays & Hashing", order_index: 1 },
  { title: "Valid Anagram", title_slug: "valid-anagram", difficulty: "Easy", category: "Arrays & Hashing", order_index: 2 },
  { title: "Two Sum", title_slug: "two-sum", difficulty: "Easy", category: "Arrays & Hashing", order_index: 3 },
  { title: "Group Anagrams", title_slug: "group-anagrams", difficulty: "Medium", category: "Arrays & Hashing", order_index: 4 },
  { title: "Top K Frequent Elements", title_slug: "top-k-frequent-elements", difficulty: "Medium", category: "Arrays & Hashing", order_index: 5 },
  { title: "Product of Array Except Self", title_slug: "product-of-array-except-self", difficulty: "Medium", category: "Arrays & Hashing", order_index: 6 },
  { title: "Valid Sudoku", title_slug: "valid-sudoku", difficulty: "Medium", category: "Arrays & Hashing", order_index: 7 },
  { title: "Encode and Decode Strings", title_slug: "encode-and-decode-strings", difficulty: "Medium", category: "Arrays & Hashing", order_index: 8 },
  { title: "Longest Consecutive Sequence", title_slug: "longest-consecutive-sequence", difficulty: "Medium", category: "Arrays & Hashing", order_index: 9 },

  // Two Pointers (5)
  { title: "Valid Palindrome", title_slug: "valid-palindrome", difficulty: "Easy", category: "Two Pointers", order_index: 10 },
  { title: "Two Sum II - Input Array Is Sorted", title_slug: "two-sum-ii-input-array-is-sorted", difficulty: "Medium", category: "Two Pointers", order_index: 11 },
  { title: "3Sum", title_slug: "3sum", difficulty: "Medium", category: "Two Pointers", order_index: 12 },
  { title: "Container With Most Water", title_slug: "container-with-most-water", difficulty: "Medium", category: "Two Pointers", order_index: 13 },
  { title: "Trapping Rain Water", title_slug: "trapping-rain-water", difficulty: "Hard", category: "Two Pointers", order_index: 14 },

  // Sliding Window (6)
  { title: "Best Time to Buy and Sell Stock", title_slug: "best-time-to-buy-and-sell-stock", difficulty: "Easy", category: "Sliding Window", order_index: 15 },
  { title: "Longest Substring Without Repeating Characters", title_slug: "longest-substring-without-repeating-characters", difficulty: "Medium", category: "Sliding Window", order_index: 16 },
  { title: "Longest Repeating Character Replacement", title_slug: "longest-repeating-character-replacement", difficulty: "Medium", category: "Sliding Window", order_index: 17 },
  { title: "Permutation in String", title_slug: "permutation-in-string", difficulty: "Medium", category: "Sliding Window", order_index: 18 },
  { title: "Minimum Window Substring", title_slug: "minimum-window-substring", difficulty: "Hard", category: "Sliding Window", order_index: 19 },
  { title: "Sliding Window Maximum", title_slug: "sliding-window-maximum", difficulty: "Hard", category: "Sliding Window", order_index: 20 },

  // Stack (7)
  { title: "Valid Parentheses", title_slug: "valid-parentheses", difficulty: "Easy", category: "Stack", order_index: 21 },
  { title: "Min Stack", title_slug: "min-stack", difficulty: "Medium", category: "Stack", order_index: 22 },
  { title: "Evaluate Reverse Polish Notation", title_slug: "evaluate-reverse-polish-notation", difficulty: "Medium", category: "Stack", order_index: 23 },
  { title: "Generate Parentheses", title_slug: "generate-parentheses", difficulty: "Medium", category: "Stack", order_index: 24 },
  { title: "Daily Temperatures", title_slug: "daily-temperatures", difficulty: "Medium", category: "Stack", order_index: 25 },
  { title: "Car Fleet", title_slug: "car-fleet", difficulty: "Medium", category: "Stack", order_index: 26 },
  { title: "Largest Rectangle in Histogram", title_slug: "largest-rectangle-in-histogram", difficulty: "Hard", category: "Stack", order_index: 27 },

  // Binary Search (7)
  { title: "Binary Search", title_slug: "binary-search", difficulty: "Easy", category: "Binary Search", order_index: 28 },
  { title: "Search a 2D Matrix", title_slug: "search-a-2d-matrix", difficulty: "Medium", category: "Binary Search", order_index: 29 },
  { title: "Koko Eating Bananas", title_slug: "koko-eating-bananas", difficulty: "Medium", category: "Binary Search", order_index: 30 },
  { title: "Search in Rotated Sorted Array", title_slug: "search-in-rotated-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 31 },
  { title: "Find Minimum in Rotated Sorted Array", title_slug: "find-minimum-in-rotated-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 32 },
  { title: "Time Based Key-Value Store", title_slug: "time-based-key-value-store", difficulty: "Medium", category: "Binary Search", order_index: 33 },
  { title: "Median of Two Sorted Arrays", title_slug: "median-of-two-sorted-arrays", difficulty: "Hard", category: "Binary Search", order_index: 34 },

  // Linked List (11)
  { title: "Reverse Linked List", title_slug: "reverse-linked-list", difficulty: "Easy", category: "Linked List", order_index: 35 },
  { title: "Merge Two Sorted Lists", title_slug: "merge-two-sorted-lists", difficulty: "Easy", category: "Linked List", order_index: 36 },
  { title: "Reorder List", title_slug: "reorder-list", difficulty: "Medium", category: "Linked List", order_index: 37 },
  { title: "Remove Nth Node From End of List", title_slug: "remove-nth-node-from-end-of-list", difficulty: "Medium", category: "Linked List", order_index: 38 },
  { title: "Copy List with Random Pointer", title_slug: "copy-list-with-random-pointer", difficulty: "Medium", category: "Linked List", order_index: 39 },
  { title: "Add Two Numbers", title_slug: "add-two-numbers", difficulty: "Medium", category: "Linked List", order_index: 40 },
  { title: "Linked List Cycle", title_slug: "linked-list-cycle", difficulty: "Easy", category: "Linked List", order_index: 41 },
  { title: "Find the Duplicate Number", title_slug: "find-the-duplicate-number", difficulty: "Medium", category: "Linked List", order_index: 42 },
  { title: "LRU Cache", title_slug: "lru-cache", difficulty: "Medium", category: "Linked List", order_index: 43 },
  { title: "Merge k Sorted Lists", title_slug: "merge-k-sorted-lists", difficulty: "Hard", category: "Linked List", order_index: 44 },
  { title: "Reverse Nodes in k-Group", title_slug: "reverse-nodes-in-k-group", difficulty: "Hard", category: "Linked List", order_index: 45 },

  // Trees (15)
  { title: "Invert Binary Tree", title_slug: "invert-binary-tree", difficulty: "Easy", category: "Trees", order_index: 46 },
  { title: "Maximum Depth of Binary Tree", title_slug: "maximum-depth-of-binary-tree", difficulty: "Easy", category: "Trees", order_index: 47 },
  { title: "Diameter of Binary Tree", title_slug: "diameter-of-binary-tree", difficulty: "Easy", category: "Trees", order_index: 48 },
  { title: "Balanced Binary Tree", title_slug: "balanced-binary-tree", difficulty: "Easy", category: "Trees", order_index: 49 },
  { title: "Same Tree", title_slug: "same-tree", difficulty: "Easy", category: "Trees", order_index: 50 },
  { title: "Subtree of Another Tree", title_slug: "subtree-of-another-tree", difficulty: "Easy", category: "Trees", order_index: 51 },
  { title: "Lowest Common Ancestor of a BST", title_slug: "lowest-common-ancestor-of-a-binary-search-tree", difficulty: "Medium", category: "Trees", order_index: 52 },
  { title: "Binary Tree Level Order Traversal", title_slug: "binary-tree-level-order-traversal", difficulty: "Medium", category: "Trees", order_index: 53 },
  { title: "Binary Tree Right Side View", title_slug: "binary-tree-right-side-view", difficulty: "Medium", category: "Trees", order_index: 54 },
  { title: "Count Good Nodes in Binary Tree", title_slug: "count-good-nodes-in-binary-tree", difficulty: "Medium", category: "Trees", order_index: 55 },
  { title: "Validate Binary Search Tree", title_slug: "validate-binary-search-tree", difficulty: "Medium", category: "Trees", order_index: 56 },
  { title: "Kth Smallest Element in a BST", title_slug: "kth-smallest-element-in-a-bst", difficulty: "Medium", category: "Trees", order_index: 57 },
  { title: "Construct Binary Tree from Preorder and Inorder Traversal", title_slug: "construct-binary-tree-from-preorder-and-inorder-traversal", difficulty: "Medium", category: "Trees", order_index: 58 },
  { title: "Binary Tree Maximum Path Sum", title_slug: "binary-tree-maximum-path-sum", difficulty: "Hard", category: "Trees", order_index: 59 },
  { title: "Serialize and Deserialize Binary Tree", title_slug: "serialize-and-deserialize-binary-tree", difficulty: "Hard", category: "Trees", order_index: 60 },

  // Tries (3)
  { title: "Implement Trie Prefix Tree", title_slug: "implement-trie-prefix-tree", difficulty: "Medium", category: "Tries", order_index: 61 },
  { title: "Design Add and Search Words Data Structure", title_slug: "design-add-and-search-words-data-structure", difficulty: "Medium", category: "Tries", order_index: 62 },
  { title: "Word Search II", title_slug: "word-search-ii", difficulty: "Hard", category: "Tries", order_index: 63 },

  // Heap / Priority Queue (7)
  { title: "Kth Largest Element in a Stream", title_slug: "kth-largest-element-in-a-stream", difficulty: "Easy", category: "Heap / Priority Queue", order_index: 64 },
  { title: "Last Stone Weight", title_slug: "last-stone-weight", difficulty: "Easy", category: "Heap / Priority Queue", order_index: 65 },
  { title: "K Closest Points to Origin", title_slug: "k-closest-points-to-origin", difficulty: "Medium", category: "Heap / Priority Queue", order_index: 66 },
  { title: "Kth Largest Element in an Array", title_slug: "kth-largest-element-in-an-array", difficulty: "Medium", category: "Heap / Priority Queue", order_index: 67 },
  { title: "Task Scheduler", title_slug: "task-scheduler", difficulty: "Medium", category: "Heap / Priority Queue", order_index: 68 },
  { title: "Design Twitter", title_slug: "design-twitter", difficulty: "Medium", category: "Heap / Priority Queue", order_index: 69 },
  { title: "Find Median from Data Stream", title_slug: "find-median-from-data-stream", difficulty: "Hard", category: "Heap / Priority Queue", order_index: 70 },

  // Backtracking (9)
  { title: "Subsets", title_slug: "subsets", difficulty: "Medium", category: "Backtracking", order_index: 71 },
  { title: "Combination Sum", title_slug: "combination-sum", difficulty: "Medium", category: "Backtracking", order_index: 72 },
  { title: "Permutations", title_slug: "permutations", difficulty: "Medium", category: "Backtracking", order_index: 73 },
  { title: "Subsets II", title_slug: "subsets-ii", difficulty: "Medium", category: "Backtracking", order_index: 74 },
  { title: "Combination Sum II", title_slug: "combination-sum-ii", difficulty: "Medium", category: "Backtracking", order_index: 75 },
  { title: "Word Search", title_slug: "word-search", difficulty: "Medium", category: "Backtracking", order_index: 76 },
  { title: "Palindrome Partitioning", title_slug: "palindrome-partitioning", difficulty: "Medium", category: "Backtracking", order_index: 77 },
  { title: "Letter Combinations of a Phone Number", title_slug: "letter-combinations-of-a-phone-number", difficulty: "Medium", category: "Backtracking", order_index: 78 },
  { title: "N-Queens", title_slug: "n-queens", difficulty: "Hard", category: "Backtracking", order_index: 79 },

  // Graphs (13)
  { title: "Number of Islands", title_slug: "number-of-islands", difficulty: "Medium", category: "Graphs", order_index: 80 },
  { title: "Clone Graph", title_slug: "clone-graph", difficulty: "Medium", category: "Graphs", order_index: 81 },
  { title: "Max Area of Island", title_slug: "max-area-of-island", difficulty: "Medium", category: "Graphs", order_index: 82 },
  { title: "Pacific Atlantic Water Flow", title_slug: "pacific-atlantic-water-flow", difficulty: "Medium", category: "Graphs", order_index: 83 },
  { title: "Surrounded Regions", title_slug: "surrounded-regions", difficulty: "Medium", category: "Graphs", order_index: 84 },
  { title: "Rotting Oranges", title_slug: "rotting-oranges", difficulty: "Medium", category: "Graphs", order_index: 85 },
  { title: "Walls and Gates", title_slug: "walls-and-gates", difficulty: "Medium", category: "Graphs", order_index: 86 },
  { title: "Course Schedule", title_slug: "course-schedule", difficulty: "Medium", category: "Graphs", order_index: 87 },
  { title: "Course Schedule II", title_slug: "course-schedule-ii", difficulty: "Medium", category: "Graphs", order_index: 88 },
  { title: "Redundant Connection", title_slug: "redundant-connection", difficulty: "Medium", category: "Graphs", order_index: 89 },
  { title: "Number of Connected Components in an Undirected Graph", title_slug: "number-of-connected-components-in-an-undirected-graph", difficulty: "Medium", category: "Graphs", order_index: 90 },
  { title: "Graph Valid Tree", title_slug: "graph-valid-tree", difficulty: "Medium", category: "Graphs", order_index: 91 },
  { title: "Word Ladder", title_slug: "word-ladder", difficulty: "Hard", category: "Graphs", order_index: 92 },

  // Advanced Graphs (6)
  { title: "Reconstruct Itinerary", title_slug: "reconstruct-itinerary", difficulty: "Hard", category: "Advanced Graphs", order_index: 93 },
  { title: "Min Cost to Connect All Points", title_slug: "min-cost-to-connect-all-points", difficulty: "Medium", category: "Advanced Graphs", order_index: 94 },
  { title: "Network Delay Time", title_slug: "network-delay-time", difficulty: "Medium", category: "Advanced Graphs", order_index: 95 },
  { title: "Swim in Rising Water", title_slug: "swim-in-rising-water", difficulty: "Hard", category: "Advanced Graphs", order_index: 96 },
  { title: "Alien Dictionary", title_slug: "alien-dictionary", difficulty: "Hard", category: "Advanced Graphs", order_index: 97 },
  { title: "Cheapest Flights Within K Stops", title_slug: "cheapest-flights-within-k-stops", difficulty: "Medium", category: "Advanced Graphs", order_index: 98 },

  // 1-D Dynamic Programming (12)
  { title: "Climbing Stairs", title_slug: "climbing-stairs", difficulty: "Easy", category: "1-D Dynamic Programming", order_index: 99 },
  { title: "Min Cost Climbing Stairs", title_slug: "min-cost-climbing-stairs", difficulty: "Easy", category: "1-D Dynamic Programming", order_index: 100 },
  { title: "House Robber", title_slug: "house-robber", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 101 },
  { title: "House Robber II", title_slug: "house-robber-ii", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 102 },
  { title: "Longest Palindromic Substring", title_slug: "longest-palindromic-substring", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 103 },
  { title: "Palindromic Substrings", title_slug: "palindromic-substrings", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 104 },
  { title: "Decode Ways", title_slug: "decode-ways", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 105 },
  { title: "Coin Change", title_slug: "coin-change", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 106 },
  { title: "Maximum Product Subarray", title_slug: "maximum-product-subarray", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 107 },
  { title: "Word Break", title_slug: "word-break", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 108 },
  { title: "Longest Increasing Subsequence", title_slug: "longest-increasing-subsequence", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 109 },
  { title: "Partition Equal Subset Sum", title_slug: "partition-equal-subset-sum", difficulty: "Medium", category: "1-D Dynamic Programming", order_index: 110 },

  // 2-D Dynamic Programming (11)
  { title: "Unique Paths", title_slug: "unique-paths", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 111 },
  { title: "Longest Common Subsequence", title_slug: "longest-common-subsequence", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 112 },
  { title: "Best Time to Buy and Sell Stock with Cooldown", title_slug: "best-time-to-buy-and-sell-stock-with-cooldown", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 113 },
  { title: "Coin Change II", title_slug: "coin-change-ii", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 114 },
  { title: "Target Sum", title_slug: "target-sum", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 115 },
  { title: "Interleaving String", title_slug: "interleaving-string", difficulty: "Medium", category: "2-D Dynamic Programming", order_index: 116 },
  { title: "Longest Increasing Path in a Matrix", title_slug: "longest-increasing-path-in-a-matrix", difficulty: "Hard", category: "2-D Dynamic Programming", order_index: 117 },
  { title: "Distinct Subsequences", title_slug: "distinct-subsequences", difficulty: "Hard", category: "2-D Dynamic Programming", order_index: 118 },
  { title: "Edit Distance", title_slug: "edit-distance", difficulty: "Hard", category: "2-D Dynamic Programming", order_index: 119 },
  { title: "Burst Balloons", title_slug: "burst-balloons", difficulty: "Hard", category: "2-D Dynamic Programming", order_index: 120 },
  { title: "Regular Expression Matching", title_slug: "regular-expression-matching", difficulty: "Hard", category: "2-D Dynamic Programming", order_index: 121 },

  // Greedy (8)
  { title: "Maximum Subarray", title_slug: "maximum-subarray", difficulty: "Medium", category: "Greedy", order_index: 122 },
  { title: "Jump Game", title_slug: "jump-game", difficulty: "Medium", category: "Greedy", order_index: 123 },
  { title: "Jump Game II", title_slug: "jump-game-ii", difficulty: "Medium", category: "Greedy", order_index: 124 },
  { title: "Gas Station", title_slug: "gas-station", difficulty: "Medium", category: "Greedy", order_index: 125 },
  { title: "Hand of Straights", title_slug: "hand-of-straights", difficulty: "Medium", category: "Greedy", order_index: 126 },
  { title: "Merge Triplets to Form Target Triplet", title_slug: "merge-triplets-to-form-target-triplet", difficulty: "Medium", category: "Greedy", order_index: 127 },
  { title: "Partition Labels", title_slug: "partition-labels", difficulty: "Medium", category: "Greedy", order_index: 128 },
  { title: "Valid Parenthesis String", title_slug: "valid-parenthesis-string", difficulty: "Medium", category: "Greedy", order_index: 129 },

  // Intervals (6)
  { title: "Insert Interval", title_slug: "insert-interval", difficulty: "Medium", category: "Intervals", order_index: 130 },
  { title: "Merge Intervals", title_slug: "merge-intervals", difficulty: "Medium", category: "Intervals", order_index: 131 },
  { title: "Non-overlapping Intervals", title_slug: "non-overlapping-intervals", difficulty: "Medium", category: "Intervals", order_index: 132 },
  { title: "Meeting Rooms", title_slug: "meeting-rooms", difficulty: "Easy", category: "Intervals", order_index: 133 },
  { title: "Meeting Rooms II", title_slug: "meeting-rooms-ii", difficulty: "Medium", category: "Intervals", order_index: 134 },
  { title: "Minimum Interval to Include Each Query", title_slug: "minimum-interval-to-include-each-query", difficulty: "Hard", category: "Intervals", order_index: 135 },

  // Math & Geometry (8)
  { title: "Rotate Image", title_slug: "rotate-image", difficulty: "Medium", category: "Math & Geometry", order_index: 136 },
  { title: "Spiral Matrix", title_slug: "spiral-matrix", difficulty: "Medium", category: "Math & Geometry", order_index: 137 },
  { title: "Set Matrix Zeroes", title_slug: "set-matrix-zeroes", difficulty: "Medium", category: "Math & Geometry", order_index: 138 },
  { title: "Happy Number", title_slug: "happy-number", difficulty: "Easy", category: "Math & Geometry", order_index: 139 },
  { title: "Plus One", title_slug: "plus-one", difficulty: "Easy", category: "Math & Geometry", order_index: 140 },
  { title: "Pow(x, n)", title_slug: "powx-n", difficulty: "Medium", category: "Math & Geometry", order_index: 141 },
  { title: "Multiply Strings", title_slug: "multiply-strings", difficulty: "Medium", category: "Math & Geometry", order_index: 142 },
  { title: "Detect Squares", title_slug: "detect-squares", difficulty: "Medium", category: "Math & Geometry", order_index: 143 },

  // Bit Manipulation (7)
  { title: "Single Number", title_slug: "single-number", difficulty: "Easy", category: "Bit Manipulation", order_index: 144 },
  { title: "Number of 1 Bits", title_slug: "number-of-1-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 145 },
  { title: "Counting Bits", title_slug: "counting-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 146 },
  { title: "Reverse Bits", title_slug: "reverse-bits", difficulty: "Easy", category: "Bit Manipulation", order_index: 147 },
  { title: "Missing Number", title_slug: "missing-number", difficulty: "Easy", category: "Bit Manipulation", order_index: 148 },
  { title: "Sum of Two Integers", title_slug: "sum-of-two-integers", difficulty: "Medium", category: "Bit Manipulation", order_index: 149 },
  { title: "Reverse Integer", title_slug: "reverse-integer", difficulty: "Medium", category: "Bit Manipulation", order_index: 150 },
];

export const STRIVER_SDE_PROBLEMS: CuratedSheetProblem[] = [
  // Day 1: Arrays
  { title: "Set Matrix Zeroes", title_slug: "set-matrix-zeroes", difficulty: "Medium", category: "Arrays", order_index: 1 },
  { title: "Pascal's Triangle", title_slug: "pascals-triangle", difficulty: "Easy", category: "Arrays", order_index: 2 },
  { title: "Next Permutation", title_slug: "next-permutation", difficulty: "Medium", category: "Arrays", order_index: 3 },
  { title: "Kadane's Algorithm (Maximum Subarray)", title_slug: "maximum-subarray", difficulty: "Medium", category: "Arrays", order_index: 4 },
  { title: "Sort an Array of 0s, 1s and 2s", title_slug: "sort-colors", difficulty: "Medium", category: "Arrays", order_index: 5 },
  { title: "Stock Buy and Sell", title_slug: "best-time-to-buy-and-sell-stock", difficulty: "Easy", category: "Arrays", order_index: 6 },

  // Day 2: Arrays Part-II
  { title: "Rotate Image", title_slug: "rotate-image", difficulty: "Medium", category: "Arrays", order_index: 7 },
  { title: "Merge Overlapping Subintervals", title_slug: "merge-intervals", difficulty: "Medium", category: "Arrays", order_index: 8 },
  { title: "Merge Two Sorted Arrays", title_slug: "merge-sorted-array", difficulty: "Easy", category: "Arrays", order_index: 9 },
  { title: "Find the Duplicate Number", title_slug: "find-the-duplicate-number", difficulty: "Medium", category: "Arrays", order_index: 10 },
  { title: "Repeat and Missing Number", title_slug: "set-mismatch", difficulty: "Easy", category: "Arrays", order_index: 11 },
  { title: "Inversion of Array", title_slug: "global-and-local-inversions", difficulty: "Medium", category: "Arrays", order_index: 12 },

  // Day 3: Arrays Part-III
  { title: "Search in a 2D Matrix", title_slug: "search-a-2d-matrix", difficulty: "Medium", category: "Arrays", order_index: 13 },
  { title: "Pow(x, n)", title_slug: "powx-n", difficulty: "Medium", category: "Arrays", order_index: 14 },
  { title: "Majority Element (>N/2)", title_slug: "majority-element", difficulty: "Easy", category: "Arrays", order_index: 15 },
  { title: "Majority Element (>N/3)", title_slug: "majority-element-ii", difficulty: "Medium", category: "Arrays", order_index: 16 },
  { title: "Grid Unique Paths", title_slug: "unique-paths", difficulty: "Medium", category: "Arrays", order_index: 17 },
  { title: "Reverse Pairs", title_slug: "reverse-pairs", difficulty: "Hard", category: "Arrays", order_index: 18 },

  // Day 4: Arrays Part-IV
  { title: "2Sum Problem", title_slug: "two-sum", difficulty: "Easy", category: "Arrays", order_index: 19 },
  { title: "4Sum Problem", title_slug: "4sum", difficulty: "Medium", category: "Arrays", order_index: 20 },
  { title: "Longest Consecutive Sequence", title_slug: "longest-consecutive-sequence", difficulty: "Medium", category: "Arrays", order_index: 21 },
  { title: "Largest Subarray with 0 Sum", title_slug: "contiguous-array", difficulty: "Medium", category: "Arrays", order_index: 22 },
  { title: "Count Number of Subarrays with Given Xor K", title_slug: "subarray-sums-divisible-by-k", difficulty: "Medium", category: "Arrays", order_index: 23 },
  { title: "Longest Substring Without Repeating Characters", title_slug: "longest-substring-without-repeating-characters", difficulty: "Medium", category: "Arrays", order_index: 24 },

  // Day 5: Linked List
  { title: "Reverse a Linked List", title_slug: "reverse-linked-list", difficulty: "Easy", category: "Linked List", order_index: 25 },
  { title: "Middle of the Linked List", title_slug: "middle-of-the-linked-list", difficulty: "Easy", category: "Linked List", order_index: 26 },
  { title: "Merge Two Sorted Lists", title_slug: "merge-two-sorted-lists", difficulty: "Easy", category: "Linked List", order_index: 27 },
  { title: "Remove Nth Node From End of List", title_slug: "remove-nth-node-from-end-of-list", difficulty: "Medium", category: "Linked List", order_index: 28 },
  { title: "Add Two Numbers", title_slug: "add-two-numbers", difficulty: "Medium", category: "Linked List", order_index: 29 },
  { title: "Delete Node in a Linked List", title_slug: "delete-node-in-a-linked-list", difficulty: "Medium", category: "Linked List", order_index: 30 },

  // Day 6: Linked List Part-II
  { title: "Intersection of Two Linked Lists", title_slug: "intersection-of-two-linked-lists", difficulty: "Easy", category: "Linked List", order_index: 31 },
  { title: "Detect a Cycle in Linked List", title_slug: "linked-list-cycle", difficulty: "Easy", category: "Linked List", order_index: 32 },
  { title: "Reverse Nodes in k-Group", title_slug: "reverse-nodes-in-k-group", difficulty: "Hard", category: "Linked List", order_index: 33 },
  { title: "Check if Linked List is Palindrome", title_slug: "palindrome-linked-list", difficulty: "Easy", category: "Linked List", order_index: 34 },
  { title: "Starting Point of Loop in Linked List", title_slug: "linked-list-cycle-ii", difficulty: "Medium", category: "Linked List", order_index: 35 },
  { title: "Flattening a Linked List", title_slug: "flatten-a-multilevel-doubly-linked-list", difficulty: "Medium", category: "Linked List", order_index: 36 },

  // Day 7: Linked List & Arrays
  { title: "Rotate a Linked List", title_slug: "rotate-list", difficulty: "Medium", category: "Linked List", order_index: 37 },
  { title: "Clone a Linked List with Random Pointer", title_slug: "copy-list-with-random-pointer", difficulty: "Medium", category: "Linked List", order_index: 38 },
  { title: "3Sum", title_slug: "3sum", difficulty: "Medium", category: "Linked List", order_index: 39 },
  { title: "Trapping Rain Water", title_slug: "trapping-rain-water", difficulty: "Hard", category: "Linked List", order_index: 40 },
  { title: "Remove Duplicates from Sorted Array", title_slug: "remove-duplicates-from-sorted-array", difficulty: "Easy", category: "Linked List", order_index: 41 },
  { title: "Max Consecutive Ones", title_slug: "max-consecutive-ones", difficulty: "Easy", category: "Linked List", order_index: 42 },

  // Day 8: Greedy
  { title: "N Meetings in One Room", title_slug: "meeting-rooms", difficulty: "Easy", category: "Greedy", order_index: 43 },
  { title: "Minimum Number of Platforms", title_slug: "meeting-rooms-ii", difficulty: "Medium", category: "Greedy", order_index: 44 },
  { title: "Job Sequencing Problem", title_slug: "course-schedule-iii", difficulty: "Hard", category: "Greedy", order_index: 45 },
  { title: "Fractional Knapsack", title_slug: "maximum-units-on-a-truck", difficulty: "Easy", category: "Greedy", order_index: 46 },
  { title: "Greedy Minimum Coins", title_slug: "coin-change", difficulty: "Medium", category: "Greedy", order_index: 47 },
  { title: "Assign Cookies", title_slug: "assign-cookies", difficulty: "Easy", category: "Greedy", order_index: 48 },

  // Day 9: Recursion & Backtracking
  { title: "Subset Sums", title_slug: "subsets", difficulty: "Medium", category: "Recursion", order_index: 49 },
  { title: "Subsets II", title_slug: "subsets-ii", difficulty: "Medium", category: "Recursion", order_index: 50 },
  { title: "Combination Sum", title_slug: "combination-sum", difficulty: "Medium", category: "Recursion", order_index: 51 },
  { title: "Combination Sum II", title_slug: "combination-sum-ii", difficulty: "Medium", category: "Recursion", order_index: 52 },
  { title: "Palindrome Partitioning", title_slug: "palindrome-partitioning", difficulty: "Medium", category: "Recursion", order_index: 53 },
  { title: "Permutation Sequence", title_slug: "permutation-sequence", difficulty: "Hard", category: "Recursion", order_index: 54 },

  // Day 10: Recursion & Backtracking Part-II
  { title: "Print All Permutations", title_slug: "permutations", difficulty: "Medium", category: "Backtracking", order_index: 55 },
  { title: "N-Queens", title_slug: "n-queens", difficulty: "Hard", category: "Backtracking", order_index: 56 },
  { title: "Sudoku Solver", title_slug: "sudoku-solver", difficulty: "Hard", category: "Backtracking", order_index: 57 },
  { title: "M-Coloring Problem", title_slug: "is-graph-bipartite", difficulty: "Medium", category: "Backtracking", order_index: 58 },
  { title: "Rat in a Maze", title_slug: "unique-paths-iii", difficulty: "Hard", category: "Backtracking", order_index: 59 },
  { title: "Word Break", title_slug: "word-break", difficulty: "Medium", category: "Backtracking", order_index: 60 },

  // Day 11: Binary Search
  { title: "Find the Element That Appears Once in Sorted Array", title_slug: "single-element-in-a-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 61 },
  { title: "Search in Rotated Sorted Array", title_slug: "search-in-rotated-sorted-array", difficulty: "Medium", category: "Binary Search", order_index: 62 },
  { title: "Median of Two Sorted Arrays", title_slug: "median-of-two-sorted-arrays", difficulty: "Hard", category: "Binary Search", order_index: 63 },
  { title: "K-th Element of Two Sorted Arrays", title_slug: "find-k-th-smallest-pair-distance", difficulty: "Hard", category: "Binary Search", order_index: 64 },
  { title: "Allocate Minimum Number of Pages", title_slug: "capacity-to-ship-packages-within-d-days", difficulty: "Medium", category: "Binary Search", order_index: 65 },
  { title: "Aggressive Cows", title_slug: "magnetic-force-between-two-balls", difficulty: "Medium", category: "Binary Search", order_index: 66 },

  // Day 12: Heaps
  { title: "Kth Largest Element in an Array", title_slug: "kth-largest-element-in-an-array", difficulty: "Medium", category: "Heaps", order_index: 67 },
  { title: "Find Median from Data Stream", title_slug: "find-median-from-data-stream", difficulty: "Hard", category: "Heaps", order_index: 68 },
  { title: "Merge K Sorted Arrays / Lists", title_slug: "merge-k-sorted-lists", difficulty: "Hard", category: "Heaps", order_index: 69 },
  { title: "Top K Frequent Elements", title_slug: "top-k-frequent-elements", difficulty: "Medium", category: "Heaps", order_index: 70 },

  // Day 13: Stack and Queue
  { title: "Implement Stack using Queues", title_slug: "implement-stack-using-queues", difficulty: "Easy", category: "Stack and Queue", order_index: 71 },
  { title: "Implement Queue using Stacks", title_slug: "implement-queue-using-stacks", difficulty: "Easy", category: "Stack and Queue", order_index: 72 },
  { title: "Valid Parentheses", title_slug: "valid-parentheses", difficulty: "Easy", category: "Stack and Queue", order_index: 73 },
  { title: "Next Greater Element", title_slug: "next-greater-element-i", difficulty: "Easy", category: "Stack and Queue", order_index: 74 },
  { title: "Next Greater Element II", title_slug: "next-greater-element-ii", difficulty: "Medium", category: "Stack and Queue", order_index: 75 },

  // Day 14: Stack and Queue Part-II
  { title: "Nearest Smaller Element", title_slug: "final-prices-with-a-special-discount-in-a-shop", difficulty: "Easy", category: "Stack and Queue", order_index: 76 },
  { title: "LRU Cache", title_slug: "lru-cache", difficulty: "Medium", category: "Stack and Queue", order_index: 77 },
  { title: "LFU Cache", title_slug: "lfu-cache", difficulty: "Hard", category: "Stack and Queue", order_index: 78 },
  { title: "Largest Rectangle in Histogram", title_slug: "largest-rectangle-in-histogram", difficulty: "Hard", category: "Stack and Queue", order_index: 79 },
  { title: "Sliding Window Maximum", title_slug: "sliding-window-maximum", difficulty: "Hard", category: "Stack and Queue", order_index: 80 },
  { title: "Min Stack", title_slug: "min-stack", difficulty: "Medium", category: "Stack and Queue", order_index: 81 },
  { title: "Rotting Oranges", title_slug: "rotting-oranges", difficulty: "Medium", category: "Stack and Queue", order_index: 82 },
  { title: "Online Stock Span", title_slug: "online-stock-span", difficulty: "Medium", category: "Stack and Queue", order_index: 83 },

  // Day 15: String
  { title: "Reverse Words in a String", title_slug: "reverse-words-in-a-string", difficulty: "Medium", category: "String", order_index: 84 },
  { title: "Longest Palindrome in a String", title_slug: "longest-palindromic-substring", difficulty: "Medium", category: "String", order_index: 85 },
  { title: "Roman to Integer", title_slug: "roman-to-integer", difficulty: "Easy", category: "String", order_index: 86 },
  { title: "Integer to Roman", title_slug: "integer-to-roman", difficulty: "Medium", category: "String", order_index: 87 },
  { title: "String to Integer (atoi)", title_slug: "string-to-integer-atoi", difficulty: "Medium", category: "String", order_index: 88 },
  { title: "Longest Common Prefix", title_slug: "longest-common-prefix", difficulty: "Easy", category: "String", order_index: 89 },
  { title: "Repeated String Match", title_slug: "repeated-string-match", difficulty: "Medium", category: "String", order_index: 90 },

  // Day 16: String Part-II
  { title: "Find the Index of the First Occurrence in a String", title_slug: "find-the-index-of-the-first-occurrence-in-a-string", difficulty: "Easy", category: "String", order_index: 91 },
  { title: "Valid Anagram", title_slug: "valid-anagram", difficulty: "Easy", category: "String", order_index: 92 },
  { title: "Count and Say", title_slug: "count-and-say", difficulty: "Medium", category: "String", order_index: 93 },
  { title: "Compare Version Numbers", title_slug: "compare-version-numbers", difficulty: "Medium", category: "String", order_index: 94 },

  // Day 17: Binary Tree
  { title: "Binary Tree Inorder Traversal", title_slug: "binary-tree-inorder-traversal", difficulty: "Easy", category: "Binary Tree", order_index: 95 },
  { title: "Binary Tree Preorder Traversal", title_slug: "binary-tree-preorder-traversal", difficulty: "Easy", category: "Binary Tree", order_index: 96 },
  { title: "Binary Tree Postorder Traversal", title_slug: "binary-tree-postorder-traversal", difficulty: "Easy", category: "Binary Tree", order_index: 97 },
  { title: "Binary Tree Right Side View", title_slug: "binary-tree-right-side-view", difficulty: "Medium", category: "Binary Tree", order_index: 98 },
  { title: "Vertical Order Traversal of a Binary Tree", title_slug: "vertical-order-traversal-of-a-binary-tree", difficulty: "Hard", category: "Binary Tree", order_index: 99 },
  { title: "Maximum Width of Binary Tree", title_slug: "maximum-width-of-binary-tree", difficulty: "Medium", category: "Binary Tree", order_index: 100 },

  // Day 18: Binary Tree Part-II
  { title: "Binary Tree Level Order Traversal", title_slug: "binary-tree-level-order-traversal", difficulty: "Medium", category: "Binary Tree", order_index: 101 },
  { title: "Maximum Depth of Binary Tree", title_slug: "maximum-depth-of-binary-tree", difficulty: "Easy", category: "Binary Tree", order_index: 102 },
  { title: "Diameter of Binary Tree", title_slug: "diameter-of-binary-tree", difficulty: "Easy", category: "Binary Tree", order_index: 103 },
  { title: "Balanced Binary Tree", title_slug: "balanced-binary-tree", difficulty: "Easy", category: "Binary Tree", order_index: 104 },
  { title: "Lowest Common Ancestor of a Binary Tree", title_slug: "lowest-common-ancestor-of-a-binary-tree", difficulty: "Medium", category: "Binary Tree", order_index: 105 },
  { title: "Same Tree", title_slug: "same-tree", difficulty: "Easy", category: "Binary Tree", order_index: 106 },
  { title: "Binary Tree Zigzag Level Order Traversal", title_slug: "binary-tree-zigzag-level-order-traversal", difficulty: "Medium", category: "Binary Tree", order_index: 107 },

  // Day 19: Binary Tree Part-III
  { title: "Binary Tree Maximum Path Sum", title_slug: "binary-tree-maximum-path-sum", difficulty: "Hard", category: "Binary Tree", order_index: 108 },
  { title: "Construct Binary Tree from Preorder and Inorder Traversal", title_slug: "construct-binary-tree-from-preorder-and-inorder-traversal", difficulty: "Medium", category: "Binary Tree", order_index: 109 },
  { title: "Construct Binary Tree from Inorder and Postorder Traversal", title_slug: "construct-binary-tree-from-inorder-and-postorder-traversal", difficulty: "Medium", category: "Binary Tree", order_index: 110 },
  { title: "Symmetric Tree", title_slug: "symmetric-tree", difficulty: "Easy", category: "Binary Tree", order_index: 111 },
  { title: "Flatten Binary Tree to Linked List", title_slug: "flatten-binary-tree-to-linked-list", difficulty: "Medium", category: "Binary Tree", order_index: 112 },

  // Day 20: Binary Search Tree
  { title: "Populating Next Right Pointers in Each Node", title_slug: "populating-next-right-pointers-in-each-node", difficulty: "Medium", category: "BST", order_index: 113 },
  { title: "Search in a Binary Search Tree", title_slug: "search-in-a-binary-search-tree", difficulty: "Easy", category: "BST", order_index: 114 },
  { title: "Validate Binary Search Tree", title_slug: "validate-binary-search-tree", difficulty: "Medium", category: "BST", order_index: 115 },
  { title: "Lowest Common Ancestor of a BST", title_slug: "lowest-common-ancestor-of-a-binary-search-tree", difficulty: "Medium", category: "BST", order_index: 116 },
  { title: "Convert Sorted Array to Binary Search Tree", title_slug: "convert-sorted-array-to-binary-search-tree", difficulty: "Easy", category: "BST", order_index: 117 },

  // Day 21: Binary Search Tree Part-II
  { title: "Kth Smallest Element in a BST", title_slug: "kth-smallest-element-in-a-bst", difficulty: "Medium", category: "BST", order_index: 118 },
  { title: "Two Sum IV - Input is a BST", title_slug: "two-sum-iv-input-is-a-bst", difficulty: "Easy", category: "BST", order_index: 119 },
  { title: "Binary Search Tree Iterator", title_slug: "binary-search-tree-iterator", difficulty: "Medium", category: "BST", order_index: 120 },
  { title: "Serialize and Deserialize Binary Tree", title_slug: "serialize-and-deserialize-binary-tree", difficulty: "Hard", category: "BST", order_index: 121 },

  // Day 22: Binary Trees Misc
  { title: "Flood Fill", title_slug: "flood-fill", difficulty: "Easy", category: "Misc", order_index: 122 },
  { title: "Kth Largest Element in a Stream", title_slug: "kth-largest-element-in-a-stream", difficulty: "Easy", category: "Misc", order_index: 123 },

  // Day 23: Graphs
  { title: "Clone Graph", title_slug: "clone-graph", difficulty: "Medium", category: "Graphs", order_index: 124 },
  { title: "Course Schedule", title_slug: "course-schedule", difficulty: "Medium", category: "Graphs", order_index: 125 },
  { title: "Course Schedule II", title_slug: "course-schedule-ii", difficulty: "Medium", category: "Graphs", order_index: 126 },
  { title: "Number of Islands", title_slug: "number-of-islands", difficulty: "Medium", category: "Graphs", order_index: 127 },
  { title: "Is Graph Bipartite?", title_slug: "is-graph-bipartite", difficulty: "Medium", category: "Graphs", order_index: 128 },

  // Day 24: Graphs Part-II
  { title: "Network Delay Time (Dijkstra)", title_slug: "network-delay-time", difficulty: "Medium", category: "Graphs", order_index: 129 },
  { title: "Cheapest Flights Within K Stops", title_slug: "cheapest-flights-within-k-stops", difficulty: "Medium", category: "Graphs", order_index: 130 },
  { title: "Min Cost to Connect All Points (Prim/Kruskal)", title_slug: "min-cost-to-connect-all-points", difficulty: "Medium", category: "Graphs", order_index: 131 },

  // Day 25: Dynamic Programming
  { title: "Maximum Product Subarray", title_slug: "maximum-product-subarray", difficulty: "Medium", category: "Dynamic Programming", order_index: 132 },
  { title: "Longest Increasing Subsequence", title_slug: "longest-increasing-subsequence", difficulty: "Medium", category: "Dynamic Programming", order_index: 133 },
  { title: "Longest Common Subsequence", title_slug: "longest-common-subsequence", difficulty: "Medium", category: "Dynamic Programming", order_index: 134 },
  { title: "Partition Equal Subset Sum (0/1 Knapsack)", title_slug: "partition-equal-subset-sum", difficulty: "Medium", category: "Dynamic Programming", order_index: 135 },
  { title: "Edit Distance", title_slug: "edit-distance", difficulty: "Hard", category: "Dynamic Programming", order_index: 136 },

  // Day 26: Dynamic Programming Part-II
  { title: "Maximum Profit in Job Scheduling", title_slug: "maximum-profit-in-job-scheduling", difficulty: "Hard", category: "Dynamic Programming", order_index: 137 },
  { title: "Coin Change", title_slug: "coin-change", difficulty: "Medium", category: "Dynamic Programming", order_index: 138 },
  { title: "Target Sum", title_slug: "target-sum", difficulty: "Medium", category: "Dynamic Programming", order_index: 139 },
  { title: "Word Break", title_slug: "word-break", difficulty: "Medium", category: "Dynamic Programming", order_index: 140 },
  { title: "Palindrome Partitioning II", title_slug: "palindrome-partitioning-ii", difficulty: "Hard", category: "Dynamic Programming", order_index: 141 },
];

export const CURATED_SHEETS: CuratedSheet[] = [
  {
    slug: "neetcode-150",
    title: "NeetCode 150",
    emoji: "NeetCode",
    description: "The premier curated roadmap covering all core coding interview patterns.",
    problems: NEETCODE_150_PROBLEMS,
  },
  {
    slug: "blind-75",
    title: "Blind 75",
    emoji: "Blind",
    description: "The essential 75 classic interview questions for fast review.",
    problems: BLIND_75_PROBLEMS,
  },
  {
    slug: "striver-sde",
    title: "Striver SDE Sheet",
    emoji: "Striver",
    description: "Comprehensive DSA sheet tailored for top-tier software engineering roles.",
    problems: STRIVER_SDE_PROBLEMS,
  },
];
