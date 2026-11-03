/**
 * Client cache key scoping. The cache must never hand one user another
 * user's rows: every stored key is owned, and invalidation and cleanup only
 * ever touch the current owner's keys.
 *
 * Run: node --no-warnings --test tests/cache/keys.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unstable_serialize } from "swr";
import { matchesNames, scopedKey, serializedOwnerPrefix } from "../../lib/cache/keys.ts";

describe("scopedKey", () => {
  it("prefixes every key with its owner", () => {
    assert.deepEqual(scopedKey("u1", ["squad-members", "sq1"]), ["u1", "squad-members", "sq1"]);
    assert.deepEqual(scopedKey(null, ["leaderboard"]), ["anon", "leaderboard"]);
  });

  it("null means do not fetch", () => {
    assert.equal(scopedKey("u1", null), null);
  });

  it("the same query for two users is two different cache entries", () => {
    const a = unstable_serialize(scopedKey("user-a", ["profile-stats"]));
    const b = unstable_serialize(scopedKey("user-b", ["profile-stats"]));
    assert.notEqual(a, b);
  });
});

describe("matchesNames (invalidation)", () => {
  it("matches the current user's entries by name", () => {
    assert.equal(matchesNames(["u1", "feed", "sq1"], "u1", ["feed"]), true);
    assert.equal(matchesNames(["u1", "feed", "sq1"], "u1", ["notifications", "feed"]), true);
  });

  it("never touches another user's entries", () => {
    assert.equal(matchesNames(["u2", "feed", "sq1"], "u1", ["feed"]), false);
    assert.equal(matchesNames(["anon", "feed"], "u1", ["feed"]), false);
  });

  it("ignores other names and non-array keys", () => {
    assert.equal(matchesNames(["u1", "feed-extra"], "u1", ["feed"]), false);
    assert.equal(matchesNames("u1,feed", "u1", ["feed"]), false);
  });
});

describe("serializedOwnerPrefix (cleanup on user change)", () => {
  it("is the prefix SWR gives every key the owner holds", () => {
    const stored = unstable_serialize(scopedKey("user-a", ["squad", "sq1", null, 3]));
    assert.ok(stored.startsWith(serializedOwnerPrefix("user-a")));
  });

  it("does not match another owner, even one whose id starts the same", () => {
    const other = unstable_serialize(scopedKey("user-ab", ["squad"]));
    assert.equal(other.startsWith(serializedOwnerPrefix("user-a")), false);
    const anon = unstable_serialize(scopedKey(null, ["squad"]));
    assert.equal(anon.startsWith(serializedOwnerPrefix("user-a")), false);
  });
});

describe("ownedBy", () => {
  it("matches every key of the owner and nothing of anyone else", async () => {
    const { ownedBy } = await import("../../lib/cache/keys.ts");
    assert.equal(ownedBy(["u1", "pinned-sheet-progress"], "u1"), true);
    assert.equal(ownedBy(["u1", "my-statuses", 3], "u1"), true);
    assert.equal(ownedBy(["u2", "pinned-sheet-progress"], "u1"), false);
    assert.equal(ownedBy(["anon", "all-problems"], null), true);
    assert.equal(ownedBy(["anon", "all-problems"], "u1"), false);
    assert.equal(ownedBy("@\"u1\",x", "u1"), false);
    assert.equal(ownedBy(null, "u1"), false);
  });
});
