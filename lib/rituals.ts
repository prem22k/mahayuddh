/**
 * Squad rituals (Step 19, Bible §30).
 *
 * Deliberately configuration, not automation. The plan says "automation comes
 * after validation", and the product rule is that a ritual only counts if people
 * actually keep it — a scheduler that nudges on Monday when nobody practises on
 * Monday is noise, not a ritual.
 *
 * Each entry points at a surface that already exists. None of them is a
 * promise the app cannot keep.
 */
export interface Ritual {
  day: string;
  label: string;
  intent: string;
  href: string;
}

export const RITUALS: Ritual[] = [
  {
    day: "Mon",
    label: "Pattern",
    intent: "Read one primer before anything else.",
    href: "/primers",
  },
  {
    day: "Tue",
    label: "Battle",
    intent: "Today's Battle, no exceptions.",
    href: "/home",
  },
  {
    day: "Wed",
    label: "Challenge",
    intent: "Send one challenge, beat somebody's time.",
    href: "/challenges",
  },
  {
    day: "Thu",
    label: "Teach",
    intent: "Write down what worked — core idea is enough.",
    href: "/practice",
  },
  {
    day: "Fri",
    label: "Revisit",
    intent: "Clear the review queue, take one revenge.",
    href: "/practice",
  },
  {
    day: "Sat",
    label: "Contest",
    intent: "Compete. Rating is a side effect, not the point.",
    href: "/leaderboard",
  },
  {
    day: "Sun",
    label: "Recap",
    intent: "Look at the week. What did the squad get through?",
    href: "/feed",
  },
];