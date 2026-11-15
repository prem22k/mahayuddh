import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "greedy",
  pattern: "Greedy",
  title: "Greedy",
  order: 11,
  prerequisites: ["intervals"],
  summary:
    "For optimisation problems where one local rule, applied again and again, gives the best overall answer: earliest end first, farthest reach, cheapest relative cost. The work is in proving the rule is safe; the code is usually a sort and one pass.",

  recognizeWhen: [
    "The question asks for the minimum or maximum count or cost, and choices are made one after another.",
    "Sorting by one key (end time, deadline, difference in cost) seems to make the decision obvious at each step.",
    "You only ever need one running number to decide the next step: the farthest index reachable, the gas left, the last end kept.",
    "A DP over states would work but looks like overkill, because one choice clearly dominates the others.",
    "You can argue: whatever the best answer does first, doing the greedy thing first instead is no worse.",
  ],

  coreIdea: `A greedy algorithm makes one choice at a time by a fixed rule and never takes it back. That is only correct if each choice is safe: some best answer agrees with it. So every greedy solution needs a reason, not just a feeling that the rule is sensible.

The usual reason is an exchange argument. Take any optimal answer. Find the first place it differs from the greedy choice, and swap the greedy choice in. Show the result is still valid and no worse. Then some optimal answer starts with the greedy choice, and the same argument repeats on what's left of the problem.

Interval scheduling shows it. To keep as many non-overlapping intervals as possible, sort by end time and keep every interval that starts at or after the last kept end. Exchange: let g be the interval that ends first, and let o be the first interval in some optimal answer. g ends no later than o, so g overlaps nothing that o didn't overlap. Swapping o for g gives an answer of the same size. So keeping g is safe. Remove everything that overlaps g and repeat.

The proof also tells you which key to sort by. Sorting by start fails: [1,100] starts first and blocks [2,3] and [4,5]. Sorting by length fails too: [4,6] is shortest but can block both [1,5] and [5,10]. Before you code a rule, try to break it with a two or three item example. If you can't find a proof or a safe swap, the problem probably needs DP.

The cost is usually the sort, O(n log n), followed by an O(n) pass. That speed is why greedy is worth the proof: when the rule is safe, it beats trying every option.`,

  walkthrough: {
    problemSlug: "non-overlapping-intervals",
    input: "intervals = [[1,10],[2,3],[4,5],[6,7]]",
    intro: "one step per interval, after sorting by end.",
    columns: ["Kept so far", "What happened", "Removed"],
    steps: [
      { window: "(none), end = −∞", action: "sort by end: [2,3] [4,5] [6,7] [1,10]", best: "0" },
      { window: "[2,3], end = 3", action: "2 ≥ −∞: keep [2,3]", best: "0" },
      { window: "[2,3] [4,5], end = 5", action: "4 ≥ 3: keep [4,5]", best: "0" },
      { window: "[2,3] [4,5] [6,7], end = 7", action: "6 ≥ 5: keep [6,7]", best: "0" },
      { window: "[2,3] [4,5] [6,7], end = 7", action: "1 < 7: [1,10] clashes, drop it", best: "1" },
    ],
    result: "1. Sorting by start would have kept [1,10] first and removed the other three.",
  },

  template: {
    code: "non-overlapping",
    note: "Sort by the key your exchange argument picked, then make the choice in one pass with a single running value (here, the last kept end). The comment at each branch is the proof in one line.",
  },

  variants: [
    {
      name: "Farthest reach",
      when: "Each position lets you move up to some distance, and you want the fewest moves or whether the end is reachable.",
      idea:
        "Track the farthest index any move so far could reach. A jump only has to be counted when you walk past the edge of the current jump's reach. It's BFS by levels without a queue: every index up to end is reachable in jumps moves.",
      code: "jump-game-ii",
      problemSlug: "jump-game-ii",
    },
    {
      name: "Reset when the running total fails",
      when: "A circular or linear run where a running balance must never go negative.",
      idea:
        "If the tank goes negative at i, then no start between the current start and i can work. Starting later only drops a prefix whose balance was never negative, which can only hurt. Jump the start to i + 1. A separate total decides whether any start works at all.",
      code: "gas-station",
      problemSlug: "gas-station",
    },
    {
      name: "Sort by a key you derive",
      when: "Each item has two options, and a fixed number must take each one.",
      idea:
        "Swap two people and compare costs. Sending x to A and y to B beats the reverse exactly when x's A-minus-B cost is lower than y's. So sort by A − B and send the first half to A. The exchange argument picks the key.",
      code: "two-city",
      problemSlug: "two-city-scheduling",
    },
  ],

  complexity: {
    time: "O(n log n) with a sort, O(n) without",
    space: "O(1) beyond the sort",
    why: "The algorithm commits to each item once and never revisits a choice, so after sorting it's a single pass. That's the whole advantage over DP, which keeps every partial answer. Jump Game II and Gas Station need no sort: they are one pass with a couple of running values.",
  },

  mistakes: [
    "Coding a rule that feels right without trying to break it. Test two or three small cases against brute force first.",
    "Sorting by the wrong key: start instead of end, length instead of end, cost instead of cost difference.",
    "Getting the touch case wrong. In non-overlapping intervals, [1,2] and [2,3] don't overlap, so the test is start ≥ end.",
    "Using greedy on 0/1 knapsack or coin change with arbitrary coins. Taking the best ratio or the biggest coin first can be wrong there; use DP.",
    "In Jump Game II, counting a jump at every index, or looping to the last index and adding a jump you don't need.",
    "In Gas Station, resetting the start without keeping the separate total that says whether any start works.",
    "Starting the last kept end at 0 when intervals can have negative starts. Start it at minus infinity.",
  ],

  notThis: [
    "Choices interact so that a locally worse step can pay off later (coin change with coins 1, 3, 4 and amount 6): use DP.",
    "You need every valid arrangement, not the best one: use backtracking.",
    "Merging or counting overlaps rather than choosing which to keep: see Intervals.",
    "The best item changes as items are added and removed: keep a heap and make the greedy choice from it. See Heap / Top-K.",
  ],

  ladder: [
    { slug: "assign-cookies", tier: "warm-up", note: "Sort both sides; give each child the smallest cookie that's enough." },
    { slug: "lemonade-change", tier: "warm-up", note: "Give change with the bigger bill first and save the 5s, which fit more cases." },
    { slug: "maximum-units-on-a-truck", tier: "warm-up", note: "Take the boxes worth the most per slot first." },
    { slug: "non-overlapping-intervals", tier: "core", note: "The template: earliest end first, proven by the exchange argument." },
    { slug: "minimum-number-of-arrows-to-burst-balloons", tier: "core", note: "The same sort by end; one arrow at each kept end." },
    { slug: "jump-game", tier: "core", note: "Track the farthest index reachable; fail if you stand beyond it." },
    { slug: "jump-game-ii", tier: "core", note: "Count jumps as levels of reach, like BFS without a queue." },
    { slug: "gas-station", tier: "core", note: "Reset the start when the tank goes negative; the total decides if any start works." },
    { slug: "partition-labels", tier: "core", note: "Stretch the current part to the last occurrence of every letter in it." },
    { slug: "two-city-scheduling", tier: "core", note: "Sort by a key you derive from a swap: A cost minus B cost." },
    { slug: "boats-to-save-people", tier: "core", note: "The heaviest person goes now; pair them with the lightest if they fit." },
    { slug: "candy", tier: "stretch", note: "Two greedy passes, one per direction, then take the max of both." },
    { slug: "minimum-number-of-taps-to-open-to-water-a-garden", tier: "stretch", note: "Jump Game II in disguise: turn each tap into a reach." },
    { slug: "patching-array", tier: "stretch", note: "Track the range of sums you can already make; patch with the smallest missing one." },
  ],
};
