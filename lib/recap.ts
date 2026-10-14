import { formatDuration } from "./format.ts";
import type { Approach, Battle, ProblemEvent, Suggestion } from "@/types/database";

/**
 * Weekly squad recap (Step 20, Bible §31/§32).
 *
 * A recap is a FROZEN projection of one week, stored so it can be shared after
 * the fact and still say what happened. It is not a source of truth: every
 * number below is derived from rows that already exist, and the window it
 * covers is carried inside the body so a recap can never be read as "now".
 *
 * Pure module: no Supabase, so the shape and every honest-if-empty decision are
 * testable.
 */

export interface RecapWindow {
  weekStart: string; // ISO date
  weekEnd: string;
}

export interface RecapEntry {
  label: string;
  detail: string;
}

export interface RecapBody {
  window: RecapWindow;
  generatedAt: string;
  squadName: string;
  /** Counts. Absent sections render as honest empty copy, not as zeroes. */
  solves: number;
  challengesSent: number;
  challengesCompleted: number;
  approachesWritten: number;
  stuckRequests: number;
  stuckHelped: number;
  /** Problems more than one squad member solved this week. */
  sharedProblems: { slug: string; solvers: number }[];
  /** Best improvement this week, when one is measurable. */
  biggestImprovement: {
    slug: string;
    fromSec: number;
    toSec: number;
    username: string | null;
  } | null;
  mostChallenged: { slug: string; title: string; count: number } | null;
  mostCopiedPrimer: { title: string; copies: number } | null;
  /** Prose lines, generated from the numbers above — never invented. */
  headline: string;
  entries: RecapEntry[];
  /** Explicitly-empty sections, so the page can teach rather than hide. */
  empty: string[];
}

export interface RecapInput {
  window: RecapWindow;
  squadName: string;
  memberIds: string[];
  usernames: Map<string, string>;
  events: ProblemEvent[];
  battles: Battle[];
  approaches: Approach[];
  challenges: Suggestion[];
  primerTitles: Map<string, string>;
  /** primer_id -> copies this week, from notebook_notes forks. */
  primerCopies: Map<string, number>;
  now?: Date;
}

export function inWindow(iso: string, w: RecapWindow): boolean {
  const day = iso.slice(0, 10);
  return day >= w.weekStart && day <= w.weekEnd;
}

/** Monday-anchored week containing `date`. */
export function weekOf(date: Date): RecapWindow {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
}

/**
 * The largest honest speed-up: same problem, same person, two solves inside the
 * window, the later one strictly faster. Requires both durations — a missing
 * time is not an improvement.
 */
export function biggestImprovement(
  battles: Battle[],
  usernames: Map<string, string>
): RecapBody["biggestImprovement"] {
  let best: RecapBody["biggestImprovement"] = null;

  const byKey = new Map<string, Battle[]>();
  for (const b of battles) {
    if (b.outcome !== "solved" || b.duration_sec == null) continue;
    const key = `${b.user_id}|${b.problem_slug}`;
    const list = byKey.get(key) ?? [];
    list.push(b);
    byKey.set(key, list);
  }

  for (const [key, list] of byKey) {
    list.sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );
    for (let i = 1; i < list.length; i++) {
      const from = list[i - 1].duration_sec as number;
      const to = list[i].duration_sec as number;
      const delta = from - to;
      if (delta <= 0) continue;
      if (best && delta <= best.fromSec - best.toSec) continue;
      const userId = key.split("|")[0];
      best = {
        slug: key.split("|")[1],
        fromSec: from,
        toSec: to,
        username: usernames.get(userId) ?? null,
      };
    }
  }

  return best;
}

export function buildRecap(input: RecapInput): RecapBody {
  const w = input.window;
  const inMember = (id: string) => input.memberIds.includes(id);

  const events = input.events.filter(
    (e) => inMember(e.user_id) && inWindow(e.created_at, w)
  );
  const solves = events.filter((e) => e.kind === "solved" || e.kind === "revisited").length;
  const stuckRequests = events.filter((e) => e.kind === "stuck").length;
  const stuckHelped = events.filter((e) => e.kind === "challenge_completed").length;

  const challenges = input.challenges.filter(
    (c) => inMember(c.from_user) && inWindow(c.created_at, w)
  );
  const challengesSent = challenges.length;
  const challengesCompleted = challenges.filter(
    (c) => c.status === "completed" && c.completed_at && inWindow(c.completed_at, w)
  ).length;

  const approaches = input.approaches.filter(
    (a) => inMember(a.user_id) && inWindow(a.created_at, w)
  );

  const battles = input.battles.filter(
    (b) => inMember(b.user_id) && inWindow(b.started_at, w)
  );

  // Shared problems: solved by more than one member.
  const solvers = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.kind !== "solved" && e.kind !== "revisited") continue;
    const set = solvers.get(e.problem_slug) ?? new Set<string>();
    set.add(e.user_id);
    solvers.set(e.problem_slug, set);
  }
  const sharedProblems = Array.from(solvers.entries())
    .filter(([, set]) => set.size > 1)
    .map(([slug, set]) => ({ slug, solvers: set.size }))
    .sort((a, b) => b.solvers - a.solvers)
    .slice(0, 5);

  // Most-challenged problem.
  const challengeCounts = new Map<string, number>();
  const challengeTitles = new Map<string, string>();
  for (const c of challenges) {
    challengeCounts.set(c.problem_slug, (challengeCounts.get(c.problem_slug) ?? 0) + 1);
    challengeTitles.set(c.problem_slug, c.problem_title);
  }
  let mostChallenged: RecapBody["mostChallenged"] = null;
  for (const [slug, count] of challengeCounts) {
    if (!mostChallenged || count > mostChallenged.count) {
      mostChallenged = { slug, title: challengeTitles.get(slug) ?? slug, count };
    }
  }

  // Most-copied primer.
  let mostCopiedPrimer: RecapBody["mostCopiedPrimer"] = null;
  for (const [id, copies] of input.primerCopies) {
    if (!mostCopiedPrimer || copies > mostCopiedPrimer.copies) {
      mostCopiedPrimer = { title: input.primerTitles.get(id) ?? "a primer", copies };
    }
  }

  const improvement = biggestImprovement(battles, input.usernames);

  // ── Prose, derived only ───────────────────────────────────────────────────
  const entries: RecapEntry[] = [];
  const empty: string[] = [];

  if (solves > 0) {
    entries.push({
      label: "Solves",
      detail: `${solves} ${solves === 1 ? "solve" : "solves"} logged across the squad.`,
    });
  } else {
    empty.push("No solves logged this week.");
  }

  if (sharedProblems.length > 0) {
    entries.push({
      label: "In common",
      detail: `${sharedProblems[0].slug} was solved by ${sharedProblems[0].solvers} of you.`,
    });
  }

  if (challengesSent > 0) {
    entries.push({
      label: "Challenges",
      detail:
        challengesCompleted > 0
          ? `${challengesSent} sent, ${challengesCompleted} answered.`
          : `${challengesSent} sent, none answered yet.`,
    });
  } else {
    empty.push("No challenges sent.");
  }

  if (improvement) {
    entries.push({
      label: "Biggest improvement",
      detail: `${improvement.username ? `@${improvement.username} ` : ""}cut ${improvement.slug} from ${formatDuration(improvement.fromSec)} to ${formatDuration(improvement.toSec)}.`,
    });
  }

  if (approaches.length > 0) {
    entries.push({
      label: "Knowledge",
      detail: `${approaches.length} ${approaches.length === 1 ? "approach" : "approaches"} written down for somebody else to read.`,
    });
  } else {
    empty.push("Nobody wrote an approach down.");
  }

  if (stuckRequests > 0) {
    entries.push({
      label: "Stuck",
      detail: `${stuckRequests} ${stuckRequests === 1 ? "request" : "requests"} for help, ${stuckHelped} answered.`,
    });
  }

  if (mostCopiedPrimer && mostCopiedPrimer.copies > 0) {
    entries.push({
      label: "Most copied",
      detail: `${mostCopiedPrimer.title} was copied ${mostCopiedPrimer.copies} ${mostCopiedPrimer.copies === 1 ? "time" : "times"}.`,
    });
  }

  // Headline never overstates. A quiet week says so.
  const headline =
    solves === 0
      ? "A quiet week. Nobody logged a solve."
      : challengesSent === 0
        ? `${solves} ${solves === 1 ? "solve" : "solves"} logged, but nobody challenged anybody — the loop is only half running.`
        : `${solves} ${solves === 1 ? "solve" : "solves"}, ${challengesSent} ${challengesSent === 1 ? "challenge" : "challenges"} out${challengesCompleted > 0 ? `, ${challengesCompleted} answered` : ""}.`;

  return {
    window: w,
    generatedAt: (input.now ?? new Date()).toISOString(),
    squadName: input.squadName,
    solves,
    challengesSent,
    challengesCompleted,
    approachesWritten: approaches.length,
    stuckRequests,
    stuckHelped,
    sharedProblems,
    biggestImprovement: improvement,
    mostChallenged,
    mostCopiedPrimer,
    headline,
    entries,
    empty,
  };
}

/** Members who did something this week — a list, not a score. */
export function activeMembers(
  events: ProblemEvent[],
  memberIds: string[],
  window: RecapWindow
): string[] {
  const active = new Set<string>();
  for (const e of events) {
    if (memberIds.includes(e.user_id) && inWindow(e.created_at, window)) active.add(e.user_id);
  }
  return Array.from(active);
}

/** WhatsApp / Discord share text (§40). A template, not an auto-post. */
export function recapShareText(weeks: { squadName: string; body: RecapBody; url: string }): string {
  const { squadName, body, url } = weeks;
  const lines = [`${squadName} — week of ${body.window.weekStart}`];
  if (body.solves > 0) lines.push(`${body.solves} solves.`);
  if (body.challengesSent > 0) {
    lines.push(
      `${body.challengesSent} challenges sent, ${body.challengesCompleted} answered.`
    );
  }
  if (body.biggestImprovement) {
    lines.push(
      `Biggest improvement: ${body.biggestImprovement.slug} ${formatDuration(body.biggestImprovement.fromSec)} → ${formatDuration(body.biggestImprovement.toSec)}.`
    );
  }
  // Empty url is allowed: the share component appends the link itself, and a
  // blank trailing line in a copied message looks like a bug.
  if (url) lines.push(url);
  return lines.join("\n");
}