/**
 * The first-run tour: six stops over the real UI, starting on the Arena.
 *
 * Each stop lists one or more targets, tried in order. The first one that is
 * on screen wins, so the same stop points at the sidebar on desktop and at the
 * tab bar on phones, and can say something different for each. A stop with no
 * visible target is skipped rather than pointed at nothing.
 */

export type Placement = "bottom" | "top" | "right" | "left";

export type TourTarget = {
  /** CSS selector; matches inside aria-hidden regions (skeletons) are ignored. */
  selector: string;
  placement: Placement;
  /** Overrides the stop's body when this target is the one shown. */
  body?: string;
  /** Scroll the target to the middle of the screen before pointing at it. */
  scroll?: boolean;
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  targets: TourTarget[];
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "battle",
    title: "Today's battle",
    body: "One problem a day, the same one for your whole squad. Start battle runs a timer, and your squad sees who solved it and how fast. A new pick lands at midnight.",
    // On /home: the Arena Pass itself (the first Pass on the page, targeted by
    // class so the home page carries no tour markup). Anywhere else the tour
    // starts (right after onboarding): the Arena entry in the nav.
    targets: [
      { selector: "main .pass", placement: "bottom", scroll: true },
      {
        selector: '[data-tour="nav-arena"]',
        placement: "right",
        body: "Today's battle lives in the Arena: one problem a day, the same one for your whole squad. A timer runs while you solve, and your squad sees who solved it and how fast.",
      },
      {
        selector: '[data-tour="tab-arena"]',
        placement: "top",
        body: "Today's battle lives in the Arena: one problem a day, the same one for your whole squad. A timer runs while you solve, and your squad sees who solved it and how fast.",
      },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    body: "What to practice next and why: your weak patterns, primers to read first, and sheets to work through. Any problem can be a battle.",
    targets: [
      { selector: '[data-tour="nav-practice"]', placement: "right" },
      { selector: '[data-tour="tab-practice"]', placement: "top" },
    ],
  },
  {
    id: "squad",
    title: "Your squad",
    body: "The 2 to 7 people you practice with: the squad streak, this week's goal, and who solved what. A squad streak only counts days when everyone solved.",
    targets: [
      { selector: '[data-tour="nav-squad"]', placement: "right" },
      { selector: '[data-tour="tab-squad"]', placement: "top" },
    ],
  },
  {
    id: "feed",
    title: "Feed",
    body: "Solves, approaches and challenges from your squad. Compare any solve with your own, or challenge the time.",
    targets: [
      { selector: '[data-tour="nav-feed"]', placement: "right" },
      { selector: '[data-tour="tab-feed"]', placement: "top" },
    ],
  },
  {
    id: "search",
    title: "Find anything",
    body: "Problems, patterns, primers and people. Press ⌘K or Ctrl K from any page.",
    targets: [
      { selector: '[data-tour="search-sidebar"]', placement: "right" },
      {
        selector: '[data-tour="search-header"]',
        placement: "bottom",
        body: "Problems, patterns, primers and people, from any page.",
      },
    ],
  },
  {
    id: "you",
    title: "You",
    body: "Your streak, your stats and your LeetCode connection, one click away.",
    targets: [
      { selector: '[data-tour="you-card"]', placement: "right" },
      {
        selector: '[data-tour="you-menu"]',
        placement: "bottom",
        body: "Your profile, Challenges, Leaderboard and Notebook live in this menu, along with everything else outside the four tabs.",
      },
    ],
  },
];
