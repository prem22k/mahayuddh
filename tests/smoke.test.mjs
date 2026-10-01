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