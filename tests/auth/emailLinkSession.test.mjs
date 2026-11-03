/**
 * The password-reset form's gate: only a session from a recent emailed link.
 * Run: node --no-warnings --test tests/auth/emailLinkSession.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRecentEmailLinkSession, EMAIL_LINK_MAX_AGE_S } from "../../lib/auth/emailLinkSession.ts";

const NOW = 1_800_000_000;
const jwt = (claims) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("isRecentEmailLinkSession", () => {
  it("accepts an emailed link verified by token hash (otp) just now", () => {
    assert.equal(isRecentEmailLinkSession(jwt({ amr: [{ method: "otp", timestamp: NOW - 30 }] }), NOW), true);
  });
  it("accepts the PKCE recovery method", () => {
    assert.equal(isRecentEmailLinkSession(jwt({ amr: [{ method: "recovery", timestamp: NOW - 60 }] }), NOW), true);
  });
  it("rejects a password or OAuth session", () => {
    assert.equal(isRecentEmailLinkSession(jwt({ amr: [{ method: "password", timestamp: NOW - 5 }] }), NOW), false);
    assert.equal(isRecentEmailLinkSession(jwt({ amr: [{ method: "oauth", timestamp: NOW - 5 }] }), NOW), false);
  });
  it("rejects an emailed-link session older than the window", () => {
    assert.equal(
      isRecentEmailLinkSession(jwt({ amr: [{ method: "otp", timestamp: NOW - EMAIL_LINK_MAX_AGE_S - 1 }] }), NOW),
      false
    );
  });
  it("rejects missing, malformed and claim-less tokens", () => {
    for (const t of [null, undefined, "", "not-a-jwt", "a.%%%.b", jwt({}), jwt({ amr: "otp" })]) {
      assert.equal(isRecentEmailLinkSession(t, NOW), false, String(t));
    }
  });
  it("reads a real base64url payload with url-unsafe characters", () => {
    const claims = { amr: [{ method: "otp", timestamp: NOW }], note: "???>>>~~~" };
    assert.equal(isRecentEmailLinkSession(jwt(claims), NOW), true);
  });
});

describe("isRecentSignIn (account deletion gate)", async () => {
  const { isRecentSignIn, lastAuthenticatedAt } = await import("../../lib/auth/jwtClaims.ts");
  it("uses the newest authentication of any method", () => {
    const t = jwt({ amr: [{ method: "oauth", timestamp: NOW - 7200 }, { method: "password", timestamp: NOW - 120 }] });
    assert.equal(lastAuthenticatedAt(t), NOW - 120);
    assert.equal(isRecentSignIn(t, NOW), true);
  });
  it("rejects a session last proved over 10 minutes ago, however recently refreshed", () => {
    assert.equal(isRecentSignIn(jwt({ amr: [{ method: "oauth", timestamp: NOW - 601 }], iat: NOW - 5 }), NOW), false);
  });
  it("rejects tokens without timestamped methods", () => {
    for (const t of [null, "", "x.y.z", jwt({}), jwt({ amr: ["password"] })]) assert.equal(isRecentSignIn(t, NOW), false);
  });
});
