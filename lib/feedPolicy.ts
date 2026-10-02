/**
 * Feed policy (Step 21, Bible §51).
 *
 * The authoritative gates live in Postgres (migration 20261003000013). This is
 * a mirror of two of them so the composer can say "this won't post" before the
 * user hits submit, instead of after.
 *
 * The mirror is deliberately incomplete and says so: it is a preview, never a
 * substitute. The server re-checks everything, and the server's answer wins.
 * A client that trusted this module as enforcement would be wrong the moment
 * somebody called the RPC directly.
 */

/** §51 high-quality objects: problem-linked, pattern-linked, actionable. */
export interface DiscussionDraft {
  problemSlug: string;
  patternTags: string[];
  body: string;
  visibility: "squad" | "global";
}

export type DraftVerdict =
  | { ok: true }
  | { ok: false; reason: "pattern" | "problem" | "body" | "actionable" | "visibility" };

const SLUG = /^[a-z0-9-]{1,80}$/;

/**
 * §20 "actionable" + §51's named low-quality shapes.
 *
 * Mirrors public.discussion_is_actionable(text) exactly — if one changes, change
 * both, or the composer will promise something the database then refuses.
 *
 * The conjunction is the whole point and was wrong the first time it was
 * written as a disjunction: matching a low-quality phrase has to REJECT a post,
 * not accept it. The SQL had the same bug, fixed in 20261003000014.
 */
const ACTIONABLE =
  /\?|try|attempt|start|read|look at|compare|sketch|draw|write|explain|watch|notice|give up|revisit|practice/i;

const LOW_QUALITY =
  /i solved|solved it|solved that|solved the problem|check this out|follow me|dm me|help me win|referral|boost|pls|plz/i;

export function isActionable(body: string): boolean {
  return ACTIONABLE.test(body) && !LOW_QUALITY.test(body);
}

export function checkDiscussionDraft(draft: DiscussionDraft): DraftVerdict {
  if (draft.patternTags.length === 0) {
    return { ok: false, reason: "pattern" };
  }
  if (!draft.problemSlug || !SLUG.test(draft.problemSlug)) {
    return { ok: false, reason: "problem" };
  }
  if (draft.body.trim().length === 0) {
    return { ok: false, reason: "body" };
  }
  if (!isActionable(draft.body)) {
    return { ok: false, reason: "actionable" };
  }
  if (draft.visibility !== "squad" && draft.visibility !== "global") {
    return { ok: false, reason: "visibility" };
  }
  return { ok: true };
}

export function draftMessage(verdict: DraftVerdict): string {
  if (verdict.ok) return "";
  switch (verdict.reason) {
    case "pattern":
      return "Tag at least one pattern so people learning it can find this.";
    case "problem":
      return "Pick the problem this is about.";
    case "body":
      return "Write something.";
    case "actionable":
      return 'Say what you tried and what the reader should try. "I solved it" is not a post.';
    case "visibility":
      return "Unknown visibility.";
  }
}

/**
 * §51: public posting needs history. Mirrors global_post_min_solves().
 *
 * This one is a preview only in a weaker sense — the count can only be known
 * authoritatively by the database, since problem_events is the source of truth.
 */
export function globalPostBlockedBy(solveCount: number, minSolves = 3): boolean {
  return solveCount < minSolves;
}

/** §19 / §51 tab shapes, in the order the plan lists them. Squad is default. */
export type FeedScope = "squad" | "following" | "global" | "platform";

export const FEED_SCOPES: FeedScope[] = ["squad", "following", "global", "platform"];

/**
 * What a scope is for, in one line each.
 *
 * Shown in the UI so a person knows why they are looking at this list. A feed
 * with no stated purpose is just a list.
 */
export const SCOPE_PURPOSE: Record<FeedScope, string> = {
  squad: "Your people. Activity, mostly chronological.",
  following: "People you chose to follow. For learning.",
  global: "Everyone. Discovery — problem-linked and pattern-linked only.",
  platform: "Contests, product changes, and maintenance. Written by us.",
};

export type FeedAction = "report" | "block" | "delete";

export const FEED_ACTIONS: { id: FeedAction; label: string; confirm?: string }[] = [
  { id: "report", label: "Report", confirm: "Report this to us?" },
  { id: "block", label: "Block", confirm: "Hide this person's activity from your feeds?" },
  { id: "delete", label: "Delete", confirm: "Delete your post? Replies stay, marked deleted." },
];

/** Why an event is not actionable for the reader — surfaced, never hidden. */
export function actionabilityLabel(usefulness: number, ageHours: number): string {
  if (usefulness <= 0) return "No downstream action yet.";
  const decay = ageHours / 168;
  if (decay > 3) return "Proven useful, a while back.";
  if (decay > 0.5) return "Proven useful.";
  return "Proven useful, recently.";
}