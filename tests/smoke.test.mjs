/**
 * Phase 0 smoke tests (node:test, zero deps).
 *
 * These import the REAL modules, not copies. The previous version re-implemented
 * toStatusMap inline, so it could not catch a regression in the shipped code.
 * Node 24 strips types natively, so importing .ts works with no build step.
 *
 * Run: npm run test:smoke
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseProblemStatusEvent, applyStatusChange } from "../lib/problemStatusEvent.ts";
import { toStatusMap, countByStatus } from "../lib/statusMap.ts";
import { safeNext } from "../lib/safeNext.ts";
import { pickDailyBattle, formatDuration, toSquadSlugSet } from "../lib/dailyBattle.ts";
import { ANALYTICS_EVENTS } from "../lib/analyticsEvents.ts";
import {
  buildBattleCard,
  buildPublicCard,
  previousBestSec,
  formatDuration as fmtCard,
  titleFromSlug,
} from "../lib/battleCard.ts";
import { chainState, longestActiveChain, chainHops, orderChainOldestFirst } from "../lib/chains.ts";
import {
  STUCK_LEVELS,
  LEVEL_RANK,
  allowedReplyLevels,
  isSpoilerLevel,
  suggestLevel,
} from "../lib/stuckLadder.ts";
import { daysBetween, relativeDays } from "../lib/format.ts";
import {
  buildRecap,
  weekOf,
  biggestImprovement,
  inWindow,
  recapShareText,
  activeMembers,
} from "../lib/recap.ts";
import { RITUALS } from "../lib/rituals.ts";
import { buildJourney, journeyWindow, median } from "../lib/journey.ts";
import { withVia, viaSlug, artifactPath, shareTargets } from "../lib/share.ts";
import {
  isActionable,
  checkDiscussionDraft,
  draftMessage,
  globalPostBlockedBy,
  FEED_SCOPES,
  SCOPE_PURPOSE,
} from "../lib/feedPolicy.ts";
import {
  rememberSource,
  consumeSource,
  peekSource,
  isValidSlug,
  SOURCE_TTL_MS,
} from "../lib/shareSource.ts";

function fakeStore() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}
import {
  inferTechnique,
  buildComparison,
  isComparable,
  differences,
  TECHNIQUE_LABEL,
} from "../lib/approachCompare.ts";
import {
  buildRevengeOffer,
  buildRevengeResult,
  revengeLabel,
  revengeResultLabel,
  latestFailure,
} from "../lib/revenge.ts";

// A real-ish LeetCode slug list: these are what must survive a round trip.
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

describe("slug guards (DB CHECK mirror)", () => {
  it("accepts real LeetCode slugs", () => {
    for (const s of ["two-sum", "lru-cache", "3sum", "trapping-rain-water"]) {
      assert.match(s, SLUG_RE);
    }
  });
  it("rejects junk that must never round-trip", () => {
    for (const s of ["Two Sum", "a/b", "", "x".repeat(81), "UPPER"]) {
      assert.doesNotMatch(s, SLUG_RE);
    }
  });
});

describe("parseProblemStatusEvent (real module)", () => {
  const evt = (detail) => ({ detail });

  it("accepts a well-formed payload and lowercases the slug", () => {
    const parsed = parseProblemStatusEvent(evt({ slug: "Two-Sum", status: "solved" }));
    assert.deepEqual(parsed, { slug: "two-sum", status: "solved" });
  });

  it("rejects an unknown status instead of merging junk", () => {
    assert.equal(parseProblemStatusEvent(evt({ slug: "two-sum", status: "banana" })), null);
  });

  it("rejects a missing slug", () => {
    assert.equal(parseProblemStatusEvent(evt({ status: "solved" })), null);
    assert.equal(parseProblemStatusEvent(evt({ slug: "", status: "solved" })), null);
  });

  it("rejects a non-event payload", () => {
    assert.equal(parseProblemStatusEvent({}), null);
  });
});

describe("toStatusMap (real module)", () => {
  it("merges rows last-write-wins", () => {
    const map = toStatusMap([
      { problem_slug: "two-sum", status: "attempted" },
      { problem_slug: "two-sum", status: "solved" },
    ]);
    assert.equal(map["two-sum"], "solved");
  });

  it("unsolved deletes the row (tri-state)", () => {
    const next = applyStatusChange({ "two-sum": "solved" }, "two-sum", "unsolved");
    assert.deepEqual(next, {});
  });
});

describe("safeNext (?next= open-redirect guard)", () => {
  it("allows same-origin relative paths, including the challenge deep link", () => {
    assert.equal(safeNext("/home"), "/home");
    assert.equal(safeNext("/c/abc-123"), "/c/abc-123");
    assert.equal(safeNext("/practice/two-sum?x=1"), "/practice/two-sum?x=1");
  });

  it("blocks absolute and protocol-relative targets", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/%2F%2Fevil.com",
      "/%5C%5Cevil.com",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      assert.equal(safeNext(bad), null, `expected null for ${String(bad)}`);
    }
  });
});

describe("formatDuration", () => {
  it("renders m:ss and refuses to invent a duration", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(61), "1:01");
    assert.equal(formatDuration(1497), "24:57");
    assert.equal(formatDuration(null), null);
    assert.equal(formatDuration(-5), null);
    assert.equal(formatDuration(NaN), null);
  });
});

describe("pickDailyBattle (deterministic engine)", () => {
  const problems = [
    { title_slug: "two-sum", title: "Two Sum", difficulty: "Easy", category: "Arrays", order_index: 1 },
    { title_slug: "lru-cache", title: "LRU Cache", difficulty: "Medium", category: "Design", order_index: 2 },
    { title_slug: "3sum", title: "3Sum", difficulty: "Medium", category: "Arrays", order_index: 3 },
    { title_slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "Easy", category: "Stack", order_index: 4 },
  ];

  it("returns null for an empty list instead of throwing", () => {
    assert.equal(pickDailyBattle({ problems: [], statusMap: {} }), null);
  });

  it("is stable for the same user and day", () => {
    const args = {
      problems,
      statusMap: { "two-sum": "attempted" },
      userId: "u1",
      dateStr: "2026-10-01",
    };
    assert.equal(
      pickDailyBattle(args)?.problem.title_slug,
      pickDailyBattle(args)?.problem.title_slug
    );
  });

  it("gives different users different battles", () => {
    // Not a guarantee for every pair, but the hash tiebreak must actually vary.
    const picks = new Set(
      Array.from({ length: 25 }, (_, i) =>
        pickDailyBattle({
          problems,
          statusMap: {},
          userId: `u${i}`,
          dateStr: "2026-10-01",
        })?.problem.title_slug
      )
    );
    assert.ok(picks.size > 1, "expected varied picks across users");
  });

  it("prefers an unsolved problem over a solved one", () => {
    const solvedAll = Object.fromEntries(problems.map((p) => [p.title_slug, "solved"]));
    const pick = pickDailyBattle({
      problems,
      statusMap: { ...solvedAll, "lru-cache": "unsolved" },
      userId: "u1",
      dateStr: "2026-10-01",
    });
    assert.equal(pick?.problem.title_slug, "lru-cache");
  });

  it("adds a truthful failure-rate why-bullet when failures are recorded", () => {
    const pick = pickDailyBattle({
      problems,
      statusMap: { "3sum": "attempted" },
      userId: "u1",
      dateStr: "2026-10-01",
      history: new Map([
        ["3sum", { failures: 2, revisits: 0, lastTouchedAt: Date.now(), bestSec: null }],
      ]),
    });
    // Whichever problem wins, no why-bullet may claim stats we don't have.
    for (const line of pick?.why ?? []) {
      assert.ok(!/failed attempts on record/.test(line) || line.includes("2 failed"));
    }
  });

  it("never labels a squad context when none was measured", () => {
    const pick = pickDailyBattle({
      problems,
      statusMap: {},
      userId: "u1",
      dateStr: "2026-10-01",
    });
    assert.equal(pick?.squadContext, null);
    assert.equal(pick?.personalBest, null);
  });

  it("surfaces a personal best only when a solved duration exists", () => {
    const pick = pickDailyBattle({
      problems,
      statusMap: { "two-sum": "solved", "lru-cache": "solved", "3sum": "solved", "valid-parentheses": "solved" },
      userId: "u1",
      dateStr: "2026-10-01",
      history: new Map([
        ["two-sum", { failures: 0, revisits: 1, lastTouchedAt: null, bestSec: 1497 }],
      ]),
    });
    if (pick?.problem.title_slug === "two-sum") {
      assert.equal(pick.personalBest, "24:57");
    }
  });
});

describe("toSquadSlugSet", () => {
  it("excludes the caller's own rows and lowercases", () => {
    const set = toSquadSlugSet(
      [
        { problem_slug: "Two-Sum", user_id: "me" },
        { problem_slug: "lru-cache", user_id: "other" },
      ],
      "me"
    );
    assert.deepEqual([...set].sort(), ["lru-cache"]);
  });
});

describe("analytics funnel vocabulary (Bible §57)", () => {
  it("declares every event the plan's funnel depends on", () => {
    for (const e of [
      "battle_started",
      "battle_solved",
      "battle_failed",
      "approach_written",
      "challenge_sent",
      "challenge_accepted",
      "challenge_completed",
      "primer_read",
      "note_copied",
      "revisit_done",
      "invite_opened",
      "signup_from_challenge",
    ]) {
      assert.ok(ANALYTICS_EVENTS.includes(e), `missing analytics event: ${e}`);
    }
  });

  it("every event name is snake_case (DB CHECK: ^[a-z0-9_]{1,60}$)", () => {
    for (const e of ANALYTICS_EVENTS) assert.match(e, /^[a-z0-9_]{1,60}$/);
  });
});
// ── Step 16: Battle Card is a projection, and it must not leak ────────────────

const at = (iso) => new Date(iso).toISOString();

function battle(over = {}) {
  return {
    id: "b1",
    user_id: "me",
    problem_slug: "two-sum",
    squad_id: "sq1",
    started_at: at("2026-10-01T10:00:00Z"),
    ended_at: at("2026-10-01T10:24:00Z"),
    duration_sec: 1497,
    outcome: "solved",
    self_reported: true,
    evidence: "none",
    scratchpad_md: "PRIVATE THINKING",
    confidence: 3,
    created_at: at("2026-10-01T10:00:00Z"),
    ...over,
  };
}

const baseInput = {
  battle: battle(),
  ownerUsername: "prem",
  squadName: "College DSA crew",
  problem: {
    title_slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    question_id: "1",
    paid_only: false,
    topics: ["Array", "Hash Table"],
    updated_at: at("2026-10-01T00:00:00Z"),
  },
  allBattles: [battle()],
  events: [],
  approaches: [],
  challenges: [],
};

describe("previousBestSec", () => {
  it("does not count this battle in its own baseline", () => {
    // If the current solve counted, every solve would tie and none would be a record.
    const { previousBestSec: prev, isPersonalRecord } = previousBestSec(battle(), [battle()]);
    assert.equal(prev, null);
    assert.equal(isPersonalRecord, false);
  });

  it("reports a record only when strictly faster", () => {
    const slower = battle({ id: "old", duration_sec: 1497, started_at: at("2026-10-01T09:00:00Z") });
    const current = battle({ id: "new", duration_sec: 1200 });
    assert.equal(previousBestSec(current, [slower, current]).isPersonalRecord, true);
    assert.equal(previousBestSec(current, [slower, current]).previousBestSec, 1497);
  });

  it("is not a record when slower than a previous solve", () => {
    const fast = battle({ id: "old", duration_sec: 900, started_at: at("2026-10-01T09:00:00Z") });
    const current = battle({ id: "new", duration_sec: 1200 });
    assert.equal(previousBestSec(current, [fast, current]).isPersonalRecord, false);
  });

  it("returns nulls for a failed battle", () => {
    const failed = battle({ outcome: "failed", duration_sec: 2400 });
    assert.deepEqual(previousBestSec(failed, [failed]), {
      previousBestSec: null,
      isPersonalRecord: false,
    });
  });

  it("ignores later battles", () => {
    const earlier = battle({ id: "old", duration_sec: 2000, started_at: at("2026-10-01T09:00:00Z") });
    const current = battle({ id: "cur", duration_sec: 1500, started_at: at("2026-10-01T10:00:00Z") });
    const future = battle({ id: "fut", duration_sec: 100, started_at: at("2026-10-02T10:00:00Z") });
    // The 100s future solve must not become the baseline for the current one.
    assert.equal(previousBestSec(current, [earlier, current, future]).previousBestSec, 2000);
  });
});

describe("buildBattleCard (full — owner and squad)", () => {
  it("projects stats and the owner\'s approach", () => {
    const card = buildBattleCard({
      ...baseInput,
      events: [
        { id: "e1", user_id: "me", problem_slug: "two-sum", kind: "revisited", battle_id: null, duration_sec: null, metadata: {}, created_at: at("2026-10-01T10:00:00Z") },
      ],
      approaches: [
        {
          id: "a1", user_id: "me", problem_slug: "two-sum", pattern: "Hash Table",
          core_idea: "One pass, hash map of seen values.", complexity_time: "O(n)",
          complexity_space: "O(n)", key_detail: null, edge_cases: null, mistakes: null,
          code: null, related_slugs: [], visibility: "private", squad_id: null,
          fork_of: null, created_at: at("2026-10-01T10:30:00Z"), updated_at: at("2026-10-01T10:30:00Z"),
        },
      ],
      challenges: [
        { id: "s1", from_user: "me", to_user: "other", problem_slug: "two-sum", problem_title: "Two Sum", difficulty: "Easy", note: null, message: null, status: "pending", sender_time_sec: null, beat_time: false, deadline_at: null, parent_id: null, spoiler: false, accepted_at: null, reminded_at: null, created_at: at("2026-10-01T11:00:00Z"), completed_at: null },
        { id: "s2", from_user: "other", to_user: "me", problem_slug: "two-sum", problem_title: "Two Sum", difficulty: "Easy", note: null, message: null, status: "completed", sender_time_sec: null, beat_time: false, deadline_at: null, parent_id: null, spoiler: false, accepted_at: null, reminded_at: null, created_at: at("2026-10-01T11:30:00Z"), completed_at: at("2026-10-02T09:00:00Z") },
      ],
    });

    assert.equal(card.stats.attempts, 1);
    assert.equal(card.stats.revisits, 1);
    assert.equal(card.stats.challengesSent, 1);
    assert.equal(card.stats.friendsCompleted, 1);
    assert.equal(card.title, "Two Sum");
    assert.equal(card.pattern, "Array");
    assert.equal(card.solvedSec, 1497);
    assert.equal(card.ownerUsername, "prem");
    assert.equal(card.squadName, "College DSA crew");
    assert.ok(card.approachExcerpt?.includes("hash map"));
  });

  it("never exposes the scratchpad", () => {
    const card = buildBattleCard(baseInput);
    assert.equal(JSON.stringify(card).includes("PRIVATE THINKING"), false);
  });

  it("omits the approach when the owner has none", () => {
    assert.equal(buildBattleCard(baseInput).approachExcerpt, null);
    assert.equal(buildBattleCard(baseInput).approachId, null);
  });

  it("reports solvedSec as null for a failed battle", () => {
    const card = buildBattleCard({
      ...baseInput,
      battle: battle({ outcome: "failed", duration_sec: 2400 }),
    });
    assert.equal(card.solvedSec, null);
  });
});

describe("buildPublicCard (share surface)", () => {
  it("drops squad identity and approach text", () => {
    const card = buildPublicCard({
      ...baseInput,
      approaches: [
        {
          id: "a1", user_id: "me", problem_slug: "two-sum", pattern: null,
          core_idea: "SECRET INSIGHT", complexity_time: null, complexity_space: null,
          key_detail: null, edge_cases: null, mistakes: null, code: null,
          related_slugs: [], visibility: "public", squad_id: null, fork_of: null,
          created_at: at("2026-10-01T10:30:00Z"), updated_at: at("2026-10-01T10:30:00Z"),
        },
      ],
    });

    assert.equal("squadName" in card, false);
    assert.equal("squadId" in card, false);
    assert.equal("approachExcerpt" in card, false);
    assert.equal("ownerId" in card, false);
    assert.equal(JSON.stringify(card).includes("SECRET INSIGHT"), false);
    // It still points at the artifact without reproducing it.
    assert.equal(card.hasSharedApproach, true);
  });

  it("does not advertise a private-only approach", () => {
    const card = buildPublicCard({
      ...baseInput,
      approaches: [
        {
          id: "a1", user_id: "me", problem_slug: "two-sum", pattern: null,
          core_idea: "PRIVATE", complexity_time: null, complexity_space: null,
          key_detail: null, edge_cases: null, mistakes: null, code: null,
          related_slugs: [], visibility: "private", squad_id: null, fork_of: null,
          created_at: at("2026-10-01T10:30:00Z"), updated_at: at("2026-10-01T10:30:00Z"),
        },
      ],
    });
    assert.equal(card.hasSharedApproach, false);
  });

  it("says self-reported when there is no LeetCode evidence", () => {
    assert.equal(buildPublicCard(baseInput).evidence, "none");
    assert.equal(buildPublicCard({ ...baseInput, battle: battle({ evidence: "leetcode" }) }).evidence, "leetcode");
  });
});

describe("battleCard formatting helpers", () => {
  it("formats durations and refuses to invent one", () => {
    assert.equal(fmtCard(1497), "24:57");
    assert.equal(fmtCard(null), null);
    assert.equal(fmtCard(undefined), null);
    assert.equal(fmtCard(NaN), null);
    assert.equal(fmtCard(-1), null);
  });

  it("derives a fallback title from the slug", () => {
    assert.equal(titleFromSlug("trapping-rain-water"), "Trapping Rain Water");
  });
});

// ── Step 17: challenge chain states ──────────────────────────────────────────

function chal(over = {}) {
  return {
    id: "x1", from_user: "a", to_user: "b", problem_slug: "lru-cache",
    problem_title: "LRU Cache", difficulty: "Medium", note: null, message: null,
    status: "pending", sender_time_sec: null, beat_time: false, deadline_at: null,
    parent_id: null, spoiler: false, accepted_at: null, reminded_at: null,
    created_at: at("2026-10-01T10:00:00Z"), completed_at: null,
    ...over,
  };
}

describe("chainState", () => {
  const now = new Date("2026-10-10T00:00:00Z");

  it("completed beats everything else", () => {
    const c = chal({ status: "completed", deadline_at: at("2026-10-05T00:00:00Z") });
    assert.equal(chainState(c, now), "completed");
  });

  it("an expired deadline is timed out, not merely pending", () => {
    const c = chal({ status: "pending", deadline_at: at("2026-10-05T00:00:00Z") });
    assert.equal(chainState(c, now), "timed_out");
  });

  it("a dismissed challenge is broken", () => {
    assert.equal(chainState(chal({ status: "dismissed" }), now), "broken");
  });

  it("pending within its deadline is active", () => {
    const c = chal({ status: "pending", deadline_at: at("2026-10-20T00:00:00Z") });
    assert.equal(chainState(c, now), "active");
  });

  it("a challenge with no deadline never times out", () => {
    assert.equal(chainState(chal({ status: "pending" }), now), "active");
  });
});

describe("longestActiveChain", () => {
  it("returns null rather than an empty object when nothing is active", () => {
    assert.equal(
      longestActiveChain([
        { ...chal({ id: "a", status: "completed" }) },
        { ...chal({ id: "b", status: "dismissed" }) },
      ]),
      null
    );
  });

  it("picks the chain with the most hops and reports its length", () => {
    const rows = [
      chal({ id: "1" }),
      chal({ id: "2", parent_id: "1" }),
      chal({ id: "3", parent_id: "2" }),
      // A separate, shorter chain must not win on recency.
      chal({ id: "9" }),
      chal({ id: "8", parent_id: "9" }),
    ];
    const best = longestActiveChain(rows);
    assert.equal(best?.hops, 3);
    assert.equal(best?.leafId, "3");
  });
});

// ── Step 17: revenge is a relationship between a failure and the solve after ──

function session(over = {}) {
  return {
    id: "s1",
    user_id: "me",
    problem_slug: "trapping-rain-water",
    squad_id: null,
    started_at: at("2026-09-21T10:00:00Z"),
    ended_at: at("2026-09-21T10:41:00Z"),
    duration_sec: 2466, // 41:06
    outcome: "failed",
    self_reported: true,
    evidence: "none",
    scratchpad_md: null,
    confidence: null,
    created_at: at("2026-09-21T10:00:00Z"),
    ...over,
  };
}

const NOW = new Date("2026-10-10T00:00:00Z");

describe("buildRevengeOffer", () => {
  it("returns null when nothing failed", () => {
    assert.equal(buildRevengeOffer("trapping-rain-water", [session({ outcome: "solved" })], "T", NOW), null);
    assert.equal(buildRevengeOffer("trapping-rain-water", [], "T", NOW), null);
  });

  it("reports the real previous duration and age", () => {
    const offer = buildRevengeOffer("trapping-rain-water", [session()], "Trapping Rain Water", NOW);
    assert.equal(offer?.title, "Trapping Rain Water");
    assert.equal(offer?.previousFailedSec, 2466);
    // 2026-09-21T10:00Z -> 2026-10-10T00:00Z is 18 full days, not 19.
  assert.equal(offer?.daysAgo, 18);
    assert.equal(offer?.failureCount, 1);
  });

  it("counts every recorded failure", () => {
    const offer = buildRevengeOffer(
      "trapping-rain-water",
      [
        session({ id: "a", started_at: at("2026-09-21T10:00:00Z") }),
        session({ id: "b", started_at: at("2026-09-25T10:00:00Z") }),
      ],
      "T",
      NOW
    );
    assert.equal(offer?.failureCount, 2);
    // Newest failure is the one on offer.
    assert.equal(offer?.previousFailedAt, at("2026-09-25T10:00:00Z"));
  });

  it("omits a duration rather than inventing one", () => {
    const offer = buildRevengeOffer("trapping-rain-water", [session({ duration_sec: null })], "T", NOW);
    assert.equal(offer?.previousFailedSec, null);
    assert.equal(revengeLabel(offer), "Failed · 18 days ago");
  });
});

describe("buildRevengeResult", () => {
  const solved = session({
    id: "w1",
    outcome: "solved",
    duration_sec: 1691, // 28:11
    started_at: at("2026-10-09T10:00:00Z"),
  });

  it("is null when the solve predates the failure", () => {
    const earlierSolve = session({
      id: "w0",
      outcome: "solved",
      started_at: at("2026-09-01T10:00:00Z"),
    });
    assert.equal(buildRevengeResult("trapping-rain-water", earlierSolve, [session(), earlierSolve], "T"), null);
  });

  it("is null when there was no failure to answer", () => {
    assert.equal(buildRevengeResult("trapping-rain-water", solved, [solved], "T"), null);
  });

  it("measures the improvement when both durations exist", () => {
    const result = buildRevengeResult("trapping-rain-water", solved, [session(), solved], "T");
    assert.equal(result?.previousFailedSec, 2466);
    assert.equal(result?.solvedSec, 1691);
    assert.equal(result?.improvementSec, 775);
    assert.equal(result?.improved, true);
    assert.equal(revengeResultLabel(result), "Previous failed 41:06 → solved 28:11");
  });

  it("does not claim an improvement when it got slower", () => {
    const slower = session({ id: "w2", outcome: "solved", duration_sec: 3000, started_at: at("2026-10-09T11:00:00Z") });
    const result = buildRevengeResult("trapping-rain-water", slower, [session(), slower], "T");
    assert.equal(result?.improved, false);
    assert.equal(result?.improvementSec, -534);
  });

  it("refuses to invent a speedup when the failure time is missing", () => {
    const untimed = session({ id: "u1", outcome: "failed", duration_sec: null, started_at: at("2026-09-21T10:00:00Z") });
    const result = buildRevengeResult("trapping-rain-water", solved, [untimed, solved], "T");
    assert.equal(result?.improvementSec, null);
    assert.equal(result?.improved, false);
    assert.equal(revengeResultLabel(result), "Previous failed time not recorded → solved 28:11");
  });
});

describe("latestFailure", () => {
  it("returns the newest failure and the total count", () => {
    const { latest, failureCount } = latestFailure([
      session({ id: "old", started_at: at("2026-01-01T00:00:00Z") }),
      session({ id: "new", started_at: at("2026-05-01T00:00:00Z") }),
      session({ id: "solved", outcome: "solved" }),
    ]);
    assert.equal(latest?.id, "new");
    assert.equal(failureCount, 2);
  });
});

describe("chainHops / orderChainOldestFirst", () => {
  it("counts the holder too, so a 3-person chain is 3", () => {
    const rows = [
      { id: "1", parent_id: null },
      { id: "2", parent_id: "1" },
      { id: "3", parent_id: "2" },
    ];
    assert.equal(chainHops(rows, "3"), 3);
    assert.equal(chainHops(rows, "1"), 1);
  });

  it("survives a cycle instead of hanging", () => {
    const rows = [
      { id: "a", parent_id: "b" },
      { id: "b", parent_id: "a" },
    ];
    assert.ok(chainHops(rows, "a") <= 10);
    assert.ok(orderChainOldestFirst(rows, "a").length <= 10);
  });

  it("orders a chain oldest-first for display", () => {
    const rows = [
      { id: "1", parent_id: null },
      { id: "2", parent_id: "1" },
      { id: "3", parent_id: "2" },
    ];
    assert.deepEqual(orderChainOldestFirst(rows, "3").map((r) => r.id), ["1", "2", "3"]);
  });
});

// ── Step 18: the ladder is the product rule, not a UI preference ─────────────

describe("stuck ladder ordering", () => {
  it("orders from least help to most", () => {
    assert.deepEqual([...STUCK_LEVELS], ["nudge", "pattern", "direction", "full"]);
    for (let i = 1; i < STUCK_LEVELS.length; i++) {
      assert.ok(LEVEL_RANK[STUCK_LEVELS[i]] > LEVEL_RANK[STUCK_LEVELS[i - 1]]);
    }
  });

  it("only ever allows a helper to answer at or below what was asked", () => {
    assert.deepEqual(allowedReplyLevels("nudge"), ["nudge"]);
    assert.deepEqual(allowedReplyLevels("pattern"), ["nudge", "pattern"]);
    assert.deepEqual(allowedReplyLevels("direction"), ["nudge", "pattern", "direction"]);
    assert.deepEqual(allowedReplyLevels("full"), ["nudge", "pattern", "direction", "full"]);
  });

  it("never lets a nudge request become a full answer", () => {
    assert.equal(allowedReplyLevels("nudge").includes("full"), false);
  });

  it("marks only 'full' as a spoiler level", () => {
    assert.equal(isSpoilerLevel("full"), true);
    assert.equal(isSpoilerLevel("direction"), false);
    assert.equal(isSpoilerLevel("nudge"), false);
  });
});

describe("suggestLevel", () => {
  it("opens at a nudge for a first attempt", () => {
    assert.equal(suggestLevel(1, false), "nudge");
  });

  it("opens higher once somebody has actually tried", () => {
    assert.equal(suggestLevel(2, false), "pattern");
    assert.equal(suggestLevel(3, true), "direction");
  });

  it("does not jump to full explanation on its own", () => {
    for (let n = 1; n <= 10; n++) {
      assert.notEqual(suggestLevel(n, true), "full");
    }
  });
});

describe("relativeDays", () => {
  it("is honest about zero and singular", () => {
    assert.equal(relativeDays(0), "today");
    assert.equal(relativeDays(1), "1 day ago");
    assert.equal(relativeDays(19), "19 days ago");
  });
});

describe("daysBetween", () => {
  it("counts whole days and never goes negative", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    assert.equal(daysBetween("2026-10-09T00:00:00Z", now), 1);
    assert.equal(daysBetween("2026-10-21T00:00:00Z", now), 0); // future -> clamped
    assert.equal(daysBetween("not-a-date", now), 0);
  });
});

// ── Step 19: comparison shows differences, never ranks ──────────────────────

function approach(over = {}) {
  return {
    id: "a1",
    user_id: "u1",
    problem_slug: "two-sum",
    pattern: null,
    core_idea: "",
    complexity_time: null,
    complexity_space: null,
    key_detail: null,
    edge_cases: null,
    mistakes: null,
    code: null,
    related_slugs: [],
    visibility: "squad",
    squad_id: null,
    fork_of: null,
    created_at: at("2026-10-01T10:00:00Z"),
    updated_at: at("2026-10-01T10:00:00Z"),
    ...over,
  };
}

describe("inferTechnique", () => {
  it("labels the common techniques from the author's own words", () => {
    assert.equal(inferTechnique({ core_idea: "Use a hash map, single pass" }), "single_pass");
    assert.equal(inferTechnique({ pattern: "Two Pointers" }), "two_pointer");
    assert.equal(inferTechnique({ core_idea: "sliding window over the array" }), "two_pointer");
    assert.equal(inferTechnique({ core_idea: "monotonic stack, next greater" }), "stack");
    assert.equal(inferTechnique({ core_idea: "BFS from the source" }), "graph_search");
    assert.equal(inferTechnique({ core_idea: "bottom-up DP with memoization" }), "dynamic_programming");
    assert.equal(inferTechnique({ core_idea: "min-heap for k largest" }), "heap");
  });

  it("says 'other' rather than guessing when there is nothing to read", () => {
    assert.equal(inferTechnique({}), "other");
    assert.equal(inferTechnique({ core_idea: "   " }), "other");
    assert.equal(inferTechnique({ core_idea: "just did it somehow" }), "other");
  });
});

describe("buildComparison", () => {
  it("groups by technique and orders the biggest group first", () => {
    const result = buildComparison([
      approach({ id: "1", core_idea: "single pass with a hash map" }),
      approach({ id: "2", core_idea: "two pointers, one from each end" }),
      approach({ id: "3", core_idea: "one pass, hash table" }),
    ]);
    assert.equal(result.total, 3);
    assert.equal(result.techniqueCount, 2);
    assert.equal(result.groups[0].technique, "single_pass");
    assert.equal(result.groups[0].rows.length, 2);
  });

  it("reports an honest technique count", () => {
    const one = buildComparison([approach({ core_idea: "BFS" })]);
    assert.equal(one.techniqueCount, 1);
    assert.equal(one.groups[0].label, TECHNIQUE_LABEL.graph_search);
  });
});

describe("isComparable", () => {
  it("needs two approaches to make a side-by-side worthwhile", () => {
    assert.equal(isComparable(0), false);
    assert.equal(isComparable(1), false);
    assert.equal(isComparable(2), true);
  });
});

describe("differences", () => {
  const row = (over) => ({ approach: approach(over), technique: "single_pass", time: null, space: null });

  it("stays neutral — no winner language anywhere", () => {
    const a = { ...row({}), technique: "single_pass", time: "O(n)" };
    const b = { ...row({}), technique: "graph_search", time: "O(n log n)" };
    const ds = differences(a, b);
    assert.ok(ds.length > 0);
    for (const d of ds) {
      assert.doesNotMatch(d, /better|worse|best|worst|faster is|loses|wins/i);
    }
  });

  it("notes a differing time claim without calling either one correct", () => {
    const a = { ...row({}), technique: "single_pass", time: "O(n)" };
    const b = { ...row({}), technique: "single_pass", time: "O(n^2)" };
    const d = differences(a, b).join(" ");
    assert.match(d, /Time claim differs/);
    assert.match(d, /may be right/);
  });

  it("flags when only one author recorded a complexity", () => {
    const a = { ...row({}), technique: "single_pass", time: "O(n)" };
    const b = { ...row({}), technique: "single_pass", time: null };
    assert.match(differences(a, b).join(" "), /Only one author recorded/);
  });

  it("says nothing when two approaches are identical in these respects", () => {
    const a = { ...row({}), technique: "stack", time: "O(n)", space: "O(n)" };
    const b = { ...row({}), technique: "stack", time: "O(n)", space: "O(n)" };
    assert.deepEqual(differences(a, b), []);
  });
});

// ── Step 20: a recap is derived, and a quiet week says so ────────────────────

function ev(kind, slug, user, day, extra = {}) {
  return {
    id: `${kind}-${slug}-${user}-${day}`,
    user_id: user,
    problem_slug: slug,
    kind,
    battle_id: null,
    duration_sec: null,
    metadata: {},
    created_at: `${day}T10:00:00.000Z`,
    ...extra,
  };
}

function bt(user, slug, day, outcome, duration_sec, id) {
  return {
    id: id ?? `${user}-${slug}-${day}`,
    user_id: user,
    problem_slug: slug,
    squad_id: null,
    started_at: `${day}T10:00:00.000Z`,
    ended_at: `${day}T10:30:00.000Z`,
    duration_sec,
    outcome,
    self_reported: true,
    evidence: "none",
    confidence: null,
    created_at: `${day}T10:00:00.000Z`,
  };
}

const W = { weekStart: "2026-10-05", weekEnd: "2026-10-11" };

const baseRecap = {
  window: W,
  squadName: "College DSA crew",
  memberIds: ["u1", "u2"],
  usernames: new Map([["u1", "prem"], ["u2", "rahul"]]),
  events: [],
  battles: [],
  approaches: [],
  challenges: [],
  primerTitles: new Map(),
  primerCopies: new Map(),
  now: new Date("2026-10-11T12:00:00Z"),
};

describe("weekOf", () => {
  it("anchors on Monday and spans seven days", () => {
    // 2026-10-07 is a Wednesday.
    const w = weekOf(new Date("2026-10-07T15:00:00Z"));
    assert.equal(w.weekStart, "2026-10-05");
    assert.equal(w.weekEnd, "2026-10-11");
  });

  it("is inclusive at both ends", () => {
    assert.equal(inWindow("2026-10-05T00:00:00Z", W), true);
    assert.equal(inWindow("2026-10-11T23:59:59Z", W), true);
    assert.equal(inWindow("2026-10-04T23:59:59Z", W), false);
    assert.equal(inWindow("2026-10-12T00:00:00Z", W), false);
  });
});

describe("buildRecap", () => {
  it("calls a quiet week quiet instead of padding it", () => {
    const body = buildRecap(baseRecap);
    assert.equal(body.solves, 0);
    assert.equal(body.challengesSent, 0);
    assert.match(body.headline, /quiet/i);
    assert.ok(body.empty.includes("No solves logged this week."));
    assert.ok(body.empty.includes("Nobody wrote an approach down."));
    assert.equal(body.entries.length, 0);
  });

  it("names the half-running loop when people solve but never challenge", () => {
    const body = buildRecap({
      ...baseRecap,
      events: [ev("solved", "two-sum", "u1", "2026-10-06")],
    });
    assert.equal(body.solves, 1);
    assert.match(body.headline, /nobody challenged anybody/);
    assert.match(body.headline, /half running/);
  });

  it("reports shared problems and completion counts", () => {
    const body = buildRecap({
      ...baseRecap,
      events: [
        ev("solved", "two-sum", "u1", "2026-10-06"),
        ev("solved", "two-sum", "u2", "2026-10-07"),
        ev("solved", "lru-cache", "u1", "2026-10-07"),
      ],
      challenges: [
        { id: "c1", from_user: "u1", to_user: "u2", problem_slug: "lru-cache", problem_title: "LRU Cache", difficulty: "Medium", status: "completed", created_at: "2026-10-06T10:00:00Z", completed_at: "2026-10-07T10:00:00Z" },
      ],
    });
    assert.equal(body.solves, 3);
    assert.equal(body.challengesSent, 1);
    assert.equal(body.challengesCompleted, 1);
    assert.equal(body.sharedProblems[0].slug, "two-sum");
    assert.equal(body.sharedProblems[0].solvers, 2);
    assert.equal(body.mostChallenged.slug, "lru-cache");
    assert.match(body.headline, /1 answered/);
  });

  it("ignores activity outside the window", () => {
    const body = buildRecap({
      ...baseRecap,
      events: [ev("solved", "two-sum", "u1", "2026-09-30")],
    });
    assert.equal(body.solves, 0);
  });

  it("ignores activity from non-members", () => {
    const body = buildRecap({
      ...baseRecap,
      events: [ev("solved", "two-sum", "stranger", "2026-10-06")],
    });
    assert.equal(body.solves, 0);
  });
});

describe("biggestImprovement", () => {
  it("picks the largest measurable speed-up", () => {
    const result = biggestImprovement(
      [
        bt("u1", "two-sum", "2026-10-06", "solved", 2466, "a"),
        bt("u1", "two-sum", "2026-10-08", "solved", 1691, "b"),
        bt("u2", "lru-cache", "2026-10-06", "solved", 900, "c"),
        bt("u2", "lru-cache", "2026-10-09", "solved", 800, "d"),
      ],
      new Map([["u1", "prem"]])
    );
    assert.equal(result.slug, "two-sum");
    assert.equal(result.fromSec, 2466);
    assert.equal(result.toSec, 1691);
    assert.equal(result.username, "prem");
  });

  it("returns null when nothing got faster", () => {
    assert.equal(
      biggestImprovement(
        [
          bt("u1", "two-sum", "2026-10-06", "solved", 900, "a"),
          bt("u1", "two-sum", "2026-10-08", "solved", 1200, "b"),
        ],
        new Map()
      ),
      null
    );
  });

  it("will not invent an improvement from a missing duration", () => {
    assert.equal(
      biggestImprovement(
        [
          bt("u1", "two-sum", "2026-10-06", "solved", null, "a"),
          bt("u1", "two-sum", "2026-10-08", "solved", 1200, "b"),
        ],
        new Map()
      ),
      null
    );
  });

  it("never compares across different people", () => {
    assert.equal(
      biggestImprovement(
        [
          bt("u1", "two-sum", "2026-10-06", "solved", 3000, "a"),
          bt("u2", "two-sum", "2026-10-08", "solved", 600, "b"),
        ],
        new Map()
      ),
      null
    );
  });
});

describe("recapShareText", () => {
  it("includes the window so a shared recap is not mistaken for now", () => {
    const body = buildRecap({
      ...baseRecap,
      events: [ev("solved", "two-sum", "u1", "2026-10-06")],
      challenges: [
        { id: "c1", from_user: "u1", to_user: "u2", problem_slug: "lru-cache", problem_title: "LRU", difficulty: "Medium", status: "completed", created_at: "2026-10-06T10:00:00Z", completed_at: "2026-10-07T10:00:00Z" },
      ],
    });
    const text = recapShareText({ squadName: "Crew", body, url: "https://x.test/r" });
    assert.match(text, /Crew — week of 2026-10-05/);
    assert.match(text, /1 solves/);
    assert.match(text, /https:\/\/x\.test\/r/);
  });
});

describe("activeMembers", () => {
  it("lists who showed up, without scoring them", () => {
    const list = activeMembers(
      [
        ev("solved", "two-sum", "u1", "2026-10-06"),
        ev("solved", "lru-cache", "u2", "2026-10-07"),
        ev("solved", "x", "stranger", "2026-10-07"),
        ev("solved", "y", "u1", "2026-09-01"),
      ],
      ["u1", "u2"],
      W
    );
    assert.deepEqual(list.sort(), ["u1", "u2"]);
  });
});

describe("rituals", () => {
  it("every ritual points at a real surface — none is a dead promise", () => {
    assert.ok(RITUALS.length >= 5);
    for (const r of RITUALS) {
      assert.ok(r.href.startsWith("/"), `${r.day} ${r.label} has no href`);
      assert.ok(r.intent.length > 10, `${r.day} ${r.label} has no intent copy`);
    }
  });

  it("covers the week", () => {
    assert.deepEqual(RITUALS.map((r) => r.day), ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
  });
});

// ── Step 20: Personal Journey ────────────────────────────────────────────────

const J = {
  userId: "me",
  username: "prem",
  days: 30,
  now: new Date("2026-10-30T12:00:00Z"),
  events: [],
  battles: [],
  approaches: [],
  challenges: [],
  stuck: [],
  problemPattern: new Map([["two-sum", "Array"], ["lru-cache", "Design"]]),
};

function jev(kind, slug, day) {
  return {
    id: `${kind}-${slug}-${day}`,
    user_id: "me",
    problem_slug: slug,
    kind,
    battle_id: null,
    duration_sec: null,
    metadata: {},
    created_at: `${day}T10:00:00.000Z`,
  };
}

function jchal(over) {
  return {
    id: "c",
    from_user: "me",
    to_user: "them",
    problem_slug: "lru-cache",
    problem_title: "LRU",
    difficulty: "Medium",
    status: "pending",
    created_at: "2026-10-20T10:00:00Z",
    completed_at: null,
    ...over,
  };
}

describe("journeyWindow", () => {
  it("spans the requested number of days inclusive", () => {
    const w = journeyWindow(30, new Date("2026-10-30T12:00:00Z"));
    assert.equal(w.days, 30);
    assert.equal(w.to, "2026-10-30");
    assert.equal(w.from, "2026-10-01");
  });
});

describe("median", () => {
  it("averages the middle pair and never invents a value", () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([1, 2, 3, 4]), 3); // (2+3)/2 = 2.5 -> 3
    assert.equal(median([]), null);
  });
});

describe("buildJourney", () => {
  it("says nothing happened rather than showing zeroes as achievement", () => {
    const j = buildJourney(J);
    assert.equal(j.battlesStarted, 0);
    assert.match(j.summary, /Nothing logged/);
  });

  it("does not say 'no battles' beside recorded solves", () => {
    // A solve logged from the roadmap matrix has no battle session. Reporting
    // zero battles next to three solves would be plainly wrong.
    const j = buildJourney({
      ...J,
      events: [jev("solved", "two-sum", "2026-10-10")],
      battles: [],
    });
    assert.equal(j.battlesStarted, 0);
    assert.equal(j.solved, 1);
    assert.doesNotMatch(j.summary, /Nothing logged|No battles/);
  });

  it("counts patterns from the catalog only, never guessing", () => {
    const j = buildJourney({
      ...J,
      events: [
        jev("solved", "two-sum", "2026-10-10"),
        jev("solved", "lru-cache", "2026-10-11"),
        jev("solved", "unknown-problem", "2026-10-12"),
      ],
    });
    assert.equal(j.solved, 3);
    // "unknown-problem" has no topic row, so it contributes no pattern.
    assert.equal(j.patterns, 2);
    assert.deepEqual(j.patternsList, ["Array", "Design"]);
  });

  it("counts revenge only when a failure preceded the solve", () => {
    const ordered = buildJourney({
      ...J,
      events: [
        jev("failed", "two-sum", "2026-10-05"),
        jev("solved", "two-sum", "2026-10-08"),
      ],
    });
    assert.equal(ordered.revengesWon, 1);
    assert.match(ordered.summary, /failed then finished/);

    // A solve with no prior failure is not a revenge.
    const noPriorFail = buildJourney({
      ...J,
      events: [jev("solved", "two-sum", "2026-10-08")],
    });
    assert.equal(noPriorFail.revengesWon, 0);
  });

  it("resolves challenge direction against the real user id", () => {
    const j = buildJourney({
      ...J,
      challenges: [
        jchal({ id: "1", from_user: "me", to_user: "them" }),
        jchal({ id: "2", from_user: "them", to_user: "me", status: "completed" }),
        jchal({ id: "3", from_user: "stranger", to_user: "someone-else", status: "completed" }),
      ],
    });
    assert.equal(j.challengesSent, 1);
    assert.equal(j.challengesReceived, 1);
    assert.equal(j.challengesAnswered, 1);
  });

  it("does not claim a median solve time when durations are unrecorded", () => {
    const j = buildJourney({
      ...J,
      events: [jev("solved", "two-sum", "2026-10-10")],
      battles: [bt("me", "two-sum", "2026-10-10", "solved", null)],
    });
    assert.equal(j.medianSolveSec, null);
    assert.equal(j.fastestSolveSec, null);
  });

  it("ignores activity outside the window", () => {
    const j = buildJourney({ ...J, events: [jev("solved", "two-sum", "2026-01-10")] });
    assert.equal(j.solved, 0);
  });
});

// ── Step 26: Loop B share attribution ─────────────────────────────────────────

describe("viaSlug", () => {
  it("is a type plus an id, never a URL", () => {
    assert.equal(viaSlug({ kind: "battle", id: "9f3c" }), "battle:9f3c");
    assert.equal(viaSlug({ kind: "journey", id: "prem" }), "journey:prem");
  });
});

describe("withVia", () => {
  const battle = { kind: "battle", id: "9f3c" };

  it("appends the slug to a bare path", () => {
    assert.equal(withVia("/b/9f3c", battle), "/b/9f3c?via=battle:9f3c");
  });

  it("keeps an existing query and a hash", () => {
    assert.equal(
      withVia("/b/9f3c?utm=x#card", battle),
      "/b/9f3c?utm=x&via=battle:9f3c#card"
    );
  });

  it("does not append a second ?via=", () => {
    assert.equal(withVia("/b/9f3c?via=primer:p1", battle), "/b/9f3c?via=primer:p1");
  });

  it("is a no-op without an artifact", () => {
    assert.equal(withVia("/b/9f3c", null), "/b/9f3c");
  });

  it("encodes an id that would otherwise break the query", () => {
    assert.equal(
      withVia(artifactPath({ kind: "journey", id: "a b&c" }), { kind: "journey", id: "a b&c" }),
      "/u/a%20b%26c?via=journey:a%20b%26c"
    );
  });

  it("keeps the colon readable instead of escaping it", () => {
    // %3A is valid but makes a shared link look machine-generated in a chat.
    assert.equal(withVia("/b/9f3c", { kind: "battle", id: "9f3c" }), "/b/9f3c?via=battle:9f3c");
  });
});

describe("artifactPath", () => {
  it("points each artifact at the surface that renders it", () => {
    assert.equal(artifactPath({ kind: "battle", id: "x" }), "/b/x");
    assert.equal(artifactPath({ kind: "recap", id: "r", squadId: "s1" }), "/squad/s1/recaps/r");
  });
});

describe("shareTargets", () => {
  it("percent-encodes both the message and the link", () => {
    const targets = shareTargets("https://mahayuddh.app/b/9f3c?via=battle:9f3c", "a & b");
    for (const t of targets) {
      assert.doesNotMatch(t.href, /[&]text=a & b/);
    }
    const whats = targets.find((t) => t.id === "whatsapp");
    assert.ok(whats.href.includes("a%20%26%20b"));
  });

  it("omits Discord, which has no public share intent", () => {
    assert.equal(shareTargets("https://x.dev", "t").some((t) => t.id === "discord"), false);
  });
});

// ── Step 26: attribution store rules ─────────────────────────────────────────

describe("isValidSlug", () => {
  it("accepts only type:id with artifact-safe characters", () => {
    assert.equal(isValidSlug("battle:9f3c"), true);
    assert.equal(isValidSlug("journey:prem"), true);
  });

  it("rejects a URL, a bare word, and anything with a query", () => {
    assert.equal(isValidSlug("https://mahayuddh.app/b/x"), false);
    assert.equal(isValidSlug("battle"), false);
    assert.equal(isValidSlug("battle:9f3c?utm=x"), false);
    assert.equal(isValidSlug("battle:../../etc"), false);
  });
});

describe("rememberSource", () => {
  it("refuses a slug that is not a slug", () => {
    const store = fakeStore();
    rememberSource("javascript:alert(1)", { store, now: 1000 });
    assert.equal(store.map.size, 0);
  });
});

describe("peekSource / consumeSource", () => {
  it("returns null when nothing was stored", () => {
    assert.equal(peekSource({ store: fakeStore(), now: 1 }), null);
    assert.equal(consumeSource({ store: fakeStore(), now: 1 }), null);
  });

  it("peeks without consuming, so a re-render cannot double-credit", () => {
    const store = fakeStore();
    rememberSource("battle:9f3c", { store, now: 1000 });
    assert.equal(peekSource({ store, now: 2000 }), "battle:9f3c");
    assert.equal(peekSource({ store, now: 2000 }), "battle:9f3c");
  });

  it("consumes once, then returns null", () => {
    const store = fakeStore();
    rememberSource("battle:9f3c", { store, now: 1000 });
    assert.equal(consumeSource({ store, now: 2000 }), "battle:9f3c");
    assert.equal(consumeSource({ store, now: 2000 }), null);
  });

  it("expires after 30 days", () => {
    const store = fakeStore();
    rememberSource("battle:9f3c", { store, now: 0 });
    assert.equal(peekSource({ store, now: SOURCE_TTL_MS - 1 }), "battle:9f3c");
    assert.equal(peekSource({ store, now: SOURCE_TTL_MS + 1 }), null);
  });

  it("treats a clock skewed into the future as expired, not as extra time", () => {
    const store = fakeStore();
    rememberSource("battle:9f3c", { store, now: 10 * SOURCE_TTL_MS });
    assert.equal(peekSource({ store, now: 0 }), null);
  });

  it("survives corrupt storage instead of throwing into a signup flow", () => {
    const store = fakeStore();
    store.setItem("mahayuddh_via", "{not json");
    assert.equal(consumeSource({ store, now: 1 }), null);
  });

  it("still credits the signup when removing the key fails", () => {
    const store = {
      getItem: () => JSON.stringify({ slug: "battle:9f3c", at: 1000 }),
      setItem: () => {},
      removeItem: () => {
        throw new Error("denied");
      },
    };
    assert.equal(consumeSource({ store, now: 2000 }), "battle:9f3c");
  });

  it("no-ops without a store, so server renders are unaffected", () => {
    assert.equal(rememberSource("battle:9f3c", { store: null, now: 1 }), undefined);
    assert.equal(peekSource({ store: null, now: 1 }), null);
  });
});

// ── Step 21: feed policy (Bible §51) ──────────────────────────────────────────

describe("isActionable", () => {
  it("accepts something the reader could actually do", () => {
    assert.equal(isActionable("Try solving it without the hash map — what breaks?"), true);
    assert.equal(isActionable("Which of these two is O(n)?"), true);
    assert.equal(isActionable("Compare your space usage with the editorial"), true);
  });

  it("rejects the low-quality shapes §51 names", () => {
    // §51 lists "generic I solved #100 posts" and engagement bait as low quality.
    assert.equal(isActionable("I solved it"), false);
    assert.equal(isActionable("solved the problem"), false);
    assert.equal(isActionable("check this out"), false);
    assert.equal(isActionable("dm me"), false);
    assert.equal(isActionable("referral code here"), false);
  });

  it("does not accept a bare link as actionable", () => {
    assert.equal(isActionable("https://example.com/solution"), false);
  });

  it("rejects a post that mixes an action word with a low-quality phrase", () => {
    // This is the case the disjunction bug slipped through: "try" satisfied the
    // action side and the bait phrase was never consulted. SQL fixed in
    // 20261003000014; this mirrors it.
    assert.equal(isActionable("Try this, but check this out"), false);
  });
});

describe("checkDiscussionDraft", () => {
  const base = {
    problemSlug: "two-sum",
    patternTags: ["Arrays"],
    body: "Try the two-pointer version — what breaks?",
    visibility: "squad",
  };

  it("accepts a complete draft", () => {
    assert.deepEqual(checkDiscussionDraft(base), { ok: true });
  });

  it("insists on a pattern, because that is how people find it", () => {
    assert.deepEqual(checkDiscussionDraft({ ...base, patternTags: [] }), {
      ok: false,
      reason: "pattern",
    });
  });

  it("insists on a problem link", () => {
    assert.deepEqual(checkDiscussionDraft({ ...base, problemSlug: "" }), {
      ok: false,
      reason: "problem",
    });
    assert.deepEqual(checkDiscussionDraft({ ...base, problemSlug: "Not A Slug" }), {
      ok: false,
      reason: "problem",
    });
  });

  it("refuses an unactionable body", () => {
    assert.deepEqual(checkDiscussionDraft({ ...base, body: "I solved it" }), {
      ok: false,
      reason: "actionable",
    });
  });

  it("whitespace is not a post", () => {
    assert.deepEqual(checkDiscussionDraft({ ...base, body: "   " }), {
      ok: false,
      reason: "body",
    });
  });

  it("has a message for every rejection reason", () => {
    for (const draft of [
      { ...base, patternTags: [] },
      { ...base, problemSlug: "" },
      { ...base, body: "" },
      { ...base, body: "I solved it" },
      { ...base, visibility: "planetwide" },
    ]) {
      const v = checkDiscussionDraft(draft);
      assert.equal(v.ok, false);
      if (!v.ok) assert.notEqual(draftMessage(v), "");
    }
    assert.equal(draftMessage({ ok: true }), "");
  });
});

describe("globalPostBlockedBy", () => {
  it("blocks Global below the solve threshold, per §51", () => {
    assert.equal(globalPostBlockedBy(0), true);
    assert.equal(globalPostBlockedBy(2), true);
    assert.equal(globalPostBlockedBy(3), false);
  });
});

describe("feed scopes", () => {
  it("lists Squad first — §19 makes it the default", () => {
    assert.deepEqual(FEED_SCOPES[0], "squad");
    assert.deepEqual([...FEED_SCOPES].sort(), ["following", "global", "platform", "squad"]);
  });

  it("states a purpose for every scope", () => {
    for (const s of FEED_SCOPES) assert.notEqual(SCOPE_PURPOSE[s], "");
  });
});
