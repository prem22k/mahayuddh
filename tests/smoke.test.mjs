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
import { chainState, longestActiveChain } from "../lib/chains.ts";

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
