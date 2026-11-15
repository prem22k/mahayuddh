import type { PrimerContent } from "../types.ts";

export const primer: PrimerContent = {
  slug: "stack",
  pattern: "Stack",
  title: "Stack",
  order: 6,
  prerequisites: ["arrays-hashing"],
  summary:
    "Push things that are still waiting to be resolved, and pop them when something arrives that resolves the most recent one. Anything nested, or anything where the newest open item has to close first, fits this shape.",

  recognizeWhen: [
    "Things open and close in nested order: brackets, tags, function calls, \"3[a2[c]]\".",
    "A new item cancels or merges with the item right before it: backspaces, adjacent duplicates, colliding asteroids.",
    "You evaluate an expression and need to hold operands until their operator shows up (Reverse Polish notation, a calculator).",
    "You must undo or go back to the most recent state, like \"..\" in a file path.",
  ],

  coreIdea: `A stack holds what hasn't been dealt with yet, newest on top. Read the input left to right. If an item opens something, push it. If an item closes something, it can only close the newest open item, which is the top: check it, then pop it.

That last-in, first-out rule is the whole reason to use a stack. In "([]{})" the ] has to close the [ that was opened most recently, not the ( from earlier. The top is always the innermost open item, so one comparison is enough.

The invariant: after reading a prefix of the input, the stack holds exactly the items that are open but not closed, in the order they were opened. So the input is valid only if no close ever meets an empty stack or the wrong top, and the stack is empty at the end.

Each item is pushed at most once and popped at most once, so the pass is O(n) even when one step pops several items. Push, pop and top are all O(1).

A plain stack isn't enough when you need the oldest pending item (that's a queue), or when you need the min or max of what's waiting without popping. Min Stack stores the minimum next to each value. For \"next greater element\" kinds of questions, keep the stack sorted: that's the Monotonic Stack primer.`,

  walkthrough: {
    problemSlug: "valid-parentheses",
    input: 's = "([]{})"',
    intro: "one step per character.",
    columns: ["Stack (bottom to top)", "What happened", "Still open"],
    steps: [
      { window: "(", action: "( opens: push", best: "1" },
      { window: "( [", action: "[ opens: push", best: "2" },
      { window: "(", action: "] needs [, top is [: pop", best: "1" },
      { window: "( {", action: "{ opens: push", best: "2" },
      { window: "(", action: "} needs {, top is {: pop", best: "1" },
      { window: "empty", action: ") needs (, top is (: pop", best: "0" },
    ],
    result: "true: no close ever met the wrong top, and nothing is left open.",
  },

  template: {
    code: "valid-parentheses",
    note: "Push what opens, check and pop the top on what closes, and look at what's left at the end. The stack problems below change what gets pushed and what a pop means.",
  },

  variants: [
    {
      name: "Operands wait for their operator",
      when: "You evaluate postfix (Reverse Polish) expressions, or any expression where an operator comes after its inputs.",
      idea:
        "Push numbers. On an operator, pop twice: the first pop is the right operand, the second the left. Push the result back. One value is left at the end.",
      code: "eval-rpn",
      problemSlug: "evaluate-reverse-polish-notation",
    },
    {
      name: "Save the outer state on open",
      when: "Nested structure where the inside has to be finished before the outside can continue, like \"3[a2[c]]\".",
      idea:
        "On [, push the text built so far and the repeat count, then start fresh. On ], pop them and set the text to the saved text plus the inside repeated. The stack remembers where each level left off.",
      code: "decode-string",
      problemSlug: "decode-string",
    },
    {
      name: "New item fights the top",
      when: "A new item can cancel the most recent survivor, and maybe the one before that too.",
      idea:
        "A left-moving asteroid hits right-moving ones on top. While it's bigger, pop and keep going. If equal, pop and stop. If smaller, it dies. Push it only if it survived.",
      code: "asteroids",
      problemSlug: "asteroid-collision",
    },
  ],

  complexity: {
    time: "O(n)",
    space: "O(n) for the stack in the worst case",
    why: "Each item is pushed at most once and popped at most once, so the total work across all the while loops is at most 2n stack operations. The worst case for space is input that only opens, like \"((((\".",
  },

  mistakes: [
    "Reading or popping the top without checking that the stack isn't empty (\"]\" on its own).",
    "Returning true at the end without checking the stack is empty, so \"((\" passes.",
    "Popping operands in the wrong order. For a − b and a / b, the first value popped is b.",
    "Rounding division the wrong way. RPN wants toward zero; Python's // rounds down, so −7 // 2 is −4, not −3.",
    "Parsing \"-11\" as a minus operator. Compare the whole token, not its first character.",
    "Using java.util.Stack, or comparing boxed Characters with ==. Use ArrayDeque, and equals or unboxed chars.",
    "Forgetting multi-digit numbers in Decode String: build the count as num × 10 + digit.",
  ],

  notThis: [
    "You need the next greater or smaller element for every index: keep the stack in sorted order, see Monotonic Stack.",
    "Items must come out in the order they arrived (first in, first out): use a queue, or BFS.",
    "You only need to know whether brackets balance with a single kind of bracket: a counter is enough, no stack needed.",
  ],

  ladder: [
    { slug: "baseball-game", tier: "warm-up", note: "Push scores; \"C\" pops, \"D\" and \"+\" read the top one or two." },
    { slug: "remove-all-adjacent-duplicates-in-string", tier: "warm-up", note: "A new character cancels the top if it matches." },
    { slug: "backspace-string-compare", tier: "warm-up", note: "# pops the last character: build both strings with a stack." },
    { slug: "valid-parentheses", tier: "core", note: "The template: push opens, match and pop on closes." },
    { slug: "min-stack", tier: "core", note: "Store the minimum so far next to every value." },
    { slug: "evaluate-reverse-polish-notation", tier: "core", note: "Operands wait on the stack; pop order matters for − and /." },
    { slug: "simplify-path", tier: "core", note: "Split on /; \"..\" pops, \".\" and empty parts do nothing." },
    { slug: "asteroid-collision", tier: "core", note: "One new item can pop several old ones, or die itself." },
    { slug: "decode-string", tier: "core", note: "Push the outer state on [, rebuild it on ]." },
    { slug: "minimum-remove-to-make-valid-parentheses", tier: "core", note: "Push indices of ( so you know which ones to delete at the end." },
    { slug: "basic-calculator", tier: "stretch", note: "Push the running result and sign on (, combine them on )." },
    { slug: "longest-valid-parentheses", tier: "stretch", note: "Keep the index before the current valid run at the bottom of the stack." },
  ],
};
