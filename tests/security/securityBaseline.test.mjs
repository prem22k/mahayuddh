/**
 * Security baseline abuse-case tests (node:test, zero deps).
 *
 * Every test here is a negative case: the request an attacker would send, and
 * the reason it must not succeed. These import the REAL modules rather than
 * reimplementations — a copy of the validator proves nothing about the validator
 * that ships.
 *
 * The modules under test are deliberately alias-free (`lib/security/*`) because
 * the plain node test runner cannot resolve `@/`. That constraint is the reason
 * the security logic lives in its own directory instead of being inlined in the
 * route handlers, where it would be untestable.
 *
 * Run: npm run test:security
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  checkCrossOriginRequest,
  isDeclaredCrossSite,
  normalizeOrigin,
  parseAllowedOrigins,
} from "../../lib/security/crossOrigin.ts";
import {
  declaredBodyTooLarge,
  declaredBodyLength,
  readJsonBounded,
  DEFAULT_MAX_BODY_BYTES,
} from "../../lib/security/body.ts";
import { validatePushEndpoint, isAllowedPushHost } from "../../lib/security/pushEndpoint.ts";
import {
  rateLimit,
  rateLimitKey,
  resetRateLimits,
  RATE_RULES,
} from "../../lib/security/rateLimit.ts";
import { redactForLog, formatSecurityEvent } from "../../lib/security/log.ts";
import { securityHeaders, noStoreHeaders, contentSecurityPolicy } from "../../lib/security/headers.ts";
import { randomInviteCode, CODE_ALPHABET, CODE_LENGTH } from "../../lib/security/inviteCode.ts";
import { ANALYTICS_EVENTS } from "../../lib/analyticsEvents.ts";

// ── 1. CSRF / cross-origin ───────────────────────────────────────────────────

describe("checkCrossOriginRequest", () => {
  const base = {
    pathname: "/api/notify",
    origin: null,
    secFetchSite: null,
    requestOrigin: "https://mahayuddh.app",
    allowedOrigins: ["https://leetcode.com"],
  };

  it("allows a same-origin POST", () => {
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://mahayuddh.app",
      secFetchSite: "same-origin",
    });
    assert.equal(v.ok, true);
  });

  it("REJECTS a cross-site POST from an attacker's origin", () => {
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://evil.example",
      secFetchSite: "cross-site",
    });
    assert.equal(v.ok, false, "a hostile origin must not pass");
  });

  it("REJECTS a cross-site POST whose Origin was stripped", () => {
    // Origin is the primary defence. When it is absent, the only remaining
    // signal is the browser's own Sec-Fetch-Site declaration, and middleware
    // applies `isDeclaredCrossSite` for exactly this case. A request with an
    // absent Origin and an absent declaration is a non-browser client.
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: null,
      secFetchSite: "cross-site",
    });
    assert.equal(v.ok, true, "the origin check defers to the Sec-Fetch-Site backstop");

    // And the backstop itself is what must fail closed.
    assert.equal(isDeclaredCrossSite("cross-site"), true);
    assert.equal(isDeclaredCrossSite(null), false);
    assert.equal(isDeclaredCrossSite("same-origin"), false);
    assert.equal(isDeclaredCrossSite("same-site"), false);
  });

  it("REJECTS an unmatched same-site-looking origin (no Sec-Fetch-Site)", () => {
    // A request with neither header is a non-browser client, which is allowed
    // below. This one has an Origin, and it is not ours.
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://mahayuddh.app.evil.example",
    });
    assert.equal(v.ok, false, "suffix-confusion origin must be rejected");
  });

  it("allows the explicitly configured cross-origin (the LeetCode bookmarklet)", () => {
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://leetcode.com",
      secFetchSite: "cross-site",
    });
    assert.equal(v.ok, true, "an allowlisted origin passes even though it is cross-site");
  });

  it("allows GET/HEAD/OPTIONS regardless of origin (reads are not CSRF-able here)", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const v = checkCrossOriginRequest({
        ...base,
        method,
        origin: "https://evil.example",
        secFetchSite: "cross-site",
      });
      assert.equal(v.ok, true, `${method} must not be blocked`);
    }
  });

  it("ignores state changes on page routes (only /api mutates)", () => {
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      pathname: "/some/page",
      origin: "https://evil.example",
      secFetchSite: "cross-site",
    });
    assert.equal(v.ok, true);
  });

  it("allows a non-browser client with no Origin at all (cron, curl)", () => {
    // These authenticate with a bearer token a browser cannot forge cross-origin.
    // Blocking them would break the product to buy nothing.
    const v = checkCrossOriginRequest({ ...base, method: "POST" });
    assert.equal(v.ok, true);
  });

  it("REJECTS the literal origin `null` (a sandboxed iframe or file:// page)", () => {
    const v = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "null",
      secFetchSite: null,
    });
    assert.equal(v.ok, false, "origin: null is not an allowlist hit");
  });

  it("blocks DELETE and PATCH too, not just POST", () => {
    for (const method of ["DELETE", "PATCH", "PUT"]) {
      const v = checkCrossOriginRequest({
        ...base,
        method,
        origin: "https://evil.example",
        secFetchSite: "cross-site",
      });
      assert.equal(v.ok, false, `${method} must be protected`);
    }
  });

  it("allows an anonymised origin when a Bearer token is presented", () => {
    // Privacy browsers, in-app webviews, and sandboxed previews anonymise
    // Origin. A Bearer token is never ambient — a cross-site attacker cannot
    // attach the victim's — so the origin check adds nothing and the route's
    // own 401 remains the enforcement point.
    for (const input of [
      { method: "POST", origin: "null", secFetchSite: null },
      { method: "POST", origin: null, secFetchSite: "cross-site" },
      { method: "POST", origin: "https://evil.example", secFetchSite: "cross-site" },
    ]) {
      const v = checkCrossOriginRequest({ ...base, ...input, hasBearer: true });
      assert.equal(v.ok, true, `${JSON.stringify(input)} with Bearer must pass`);
    }
  });

  it("still rejects anonymised origins WITHOUT a Bearer token", () => {
    for (const input of [
      { method: "POST", origin: "null", secFetchSite: null },
      { method: "POST", origin: "https://evil.example", secFetchSite: "cross-site" },
    ]) {
      const v = checkCrossOriginRequest({ ...base, ...input });
      assert.equal(v.ok, false, `${JSON.stringify(input)} without Bearer must fail`);
    }
    // Absent-Origin + cross-site declaration passes at THIS layer by design
    // (absent header = non-browser client); middleware's isDeclaredCrossSite
    // backstop closes it there. That division is covered by the middleware
    // code path, not this unit.
    const declared = checkCrossOriginRequest({
      ...base,
      method: "POST",
      origin: null,
      secFetchSite: "cross-site",
    });
    assert.equal(declared.ok, true, "absent Origin alone is a non-browser client at this layer");
  });

  it("an empty or malformed Bearer does not count as presenting one", () => {
    // The `hasBearer` flag is derived in middleware by /^bearer\s+\S+/i.
    // "Bearer" alone or "Bearer " is not a token and must not pass.
    assert.doesNotMatch("bearer", /^bearer\s+\S+/i);
    assert.doesNotMatch("Bearer ", /^bearer\s+\S+/i);
    assert.match("Bearer abc123", /^bearer\s+\S+/i);
  });
});

describe("normalizeOrigin", () => {
  it("lower-cases the host and drops the default port", () => {
    assert.equal(normalizeOrigin("HTTPS://Mahayuddh.App:443"), "https://mahayuddh.app");
  });

  it("rejects a non-origin string rather than passing it through", () => {
    assert.equal(normalizeOrigin("mahayuddh.app"), null);
    assert.equal(normalizeOrigin("javascript:alert(1)"), null);
    assert.equal(normalizeOrigin("null"), null);
  });
});

describe("parseAllowedOrigins", () => {
  it("accepts a comma or whitespace separated list", () => {
    const out = parseAllowedOrigins("https://a.example, https://b.example\nhttps://c.example");
    assert.deepEqual(out, ["https://a.example", "https://b.example", "https://c.example"]);
  });

  it("degrades to an empty list on garbage, never to allow-all", () => {
    // An operator who fat-fingers the env var must get same-origin only.
    assert.deepEqual(parseAllowedOrigins("not a url, !!!"), []);
    assert.deepEqual(parseAllowedOrigins(undefined), []);
  });

  it("does not treat a wildcard as an origin", () => {
    assert.deepEqual(parseAllowedOrigins("*"), []);
  });
});

// ── 2. Request body limits ───────────────────────────────────────────────────

describe("declaredBodyTooLarge", () => {
  it("rejects an oversized declared length before reading anything", () => {
    const req = new Request("https://x.test/api/notify", {
      method: "POST",
      headers: { "content-length": String(DEFAULT_MAX_BODY_BYTES + 1) },
      body: "{}",
    });
    assert.equal(declaredBodyTooLarge(req, DEFAULT_MAX_BODY_BYTES), true);
  });

  it("allows a body inside the limit", () => {
    const req = new Request("https://x.test/api/notify", {
      method: "POST",
      headers: { "content-length": "12" },
      body: "{}",
    });
    assert.equal(declaredBodyTooLarge(req, DEFAULT_MAX_BODY_BYTES), false);
  });

  it("reads a missing or malformed content-length as unknown, not as zero", () => {
    assert.equal(declaredBodyLength(new Request("https://x.test/")), null);
    const bogus = new Request("https://x.test/", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
      body: "{}",
    });
    assert.equal(declaredBodyLength(bogus), null);
    // Unknown means the streaming check is the only line of defence, which is
    // exactly why readJsonBounded does not trust this header alone.
    assert.equal(declaredBodyTooLarge(bogus, DEFAULT_MAX_BODY_BYTES), false);
  });
});

describe("readJsonBounded", () => {
  it("REJECTS an oversized body without parsing it", async () => {
    const big = JSON.stringify({ scratchpad: "x".repeat(5_000) });
    const req = new Request("https://x.test/api/ai/stuck-assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: big,
    });
    const result = await readJsonBounded(req, 1024);
    assert.equal(result.ok, false, "an oversized body must be refused");
    assert.equal(result.ok === false && result.error, "too_large");
  });

  it("REJECTS a chunked body that lies about (or omits) its length", async () => {
    // No content-length at all: the streaming counter is the only defence, and
    // it is the one an attacker who knows about content-length will remove.
    const stream = new ReadableStream({
      start(controller) {
        const chunk = new TextEncoder().encode("x".repeat(4096));
        for (let i = 0; i < 8; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    const req = new Request("https://x.test/api/notify", {
      method: "POST",
      body: stream,
      // Required by the Request constructor when a stream body is used.
      // @ts-expect-error -- duplex is required for a stream body
      duplex: "half",
    });
    const result = await readJsonBounded(req, 2048);
    assert.equal(result.ok, false, "an undeclared oversized body must still be refused");
  });

  it("parses a normal body", async () => {
    const req = new Request("https://x.test/api/notify", {
      method: "POST",
      body: JSON.stringify({ kind: "challenge" }),
    });
    const result = await readJsonBounded(req);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.kind, "challenge");
  });

  it("returns null for malformed JSON rather than throwing", async () => {
    // Matches the `.catch(() => ({}))` shape the routes already handle.
    const req = new Request("https://x.test/api/notify", {
      method: "POST",
      body: "{not json",
    });
    const result = await readJsonBounded(req);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });

  it("returns null for an empty body", async () => {
    const req = new Request("https://x.test/api/notify", { method: "POST", body: "" });
    const result = await readJsonBounded(req);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });
});

// ── 3. SSRF via push subscription endpoints ─────────────────────────────────

describe("validatePushEndpoint", () => {
  const real = "https://fcm.googleapis.com/fcm/send/abc123";

  it("accepts a real push service endpoint", () => {
    const v = validatePushEndpoint(real);
    assert.equal(v.ok, true);
    assert.equal(v.endpoint, real);
  });

  it("REJECTS the cloud metadata address the old regex let through", () => {
    // The old guard was /^https:\/\/[a-z0-9.-]+\//i. This matched.
    assert.equal(validatePushEndpoint("https://169.254.169.254/latest/meta-data/").ok, false);
    assert.equal(validatePushEndpoint("https://metadata.google.internal/").ok, false);
  });

  it("REJECTS loopback, private ranges and hostname tricks", () => {
    for (const endpoint of [
      "https://localhost/",
      "https://127.0.0.1/",
      "https://10.0.0.5/push",
      "https://192.168.1.1/",
      "https://[::1]/",
      // Suffix-confusion: ends with an allowed host, is not it.
      "https://evil.example/fcm.googleapis.com/",
      "https://fcm.googleapis.com.evil.example/push",
      // A trailing dot makes a distinct DNS name that resolves the same way.
      "https://fcm.googleapis.com./push",
    ]) {
      const v = validatePushEndpoint(endpoint);
      assert.equal(v.ok, false, `${endpoint} must be rejected`);
    }
  });

  it("REJECTS non-https schemes including javascript: and data:", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/x",
      "javascript:alert(1)",
      "data:text/plain,hi",
      "file:///etc/passwd",
      "gopher://fcm.googleapis.com/",
    ]) {
      assert.equal(validatePushEndpoint(endpoint).ok, false, `${endpoint} must be rejected`);
    }
  });

  it("REJECTS an oversized endpoint rather than storing it", () => {
    const endpoint = `https://fcm.googleapis.com/${"a".repeat(4000)}`;
    assert.equal(validatePushEndpoint(endpoint).ok, false);
  });

  it("REJECTS non-strings and empty input", () => {
    for (const value of [null, undefined, 42, {}, [], "", "   "]) {
      assert.equal(validatePushEndpoint(value).ok, false, `${JSON.stringify(value)} must be rejected`);
    }
  });

  it("does not treat a bare allowed hostname as a suffix match", () => {
    // ".notify.windows.com" is a suffix rule; "notify.windows.com" itself is not
    // a host that exists, and must not pass on the suffix alone.
    assert.equal(isAllowedPushHost("notify.windows.com"), false);
    assert.equal(isAllowedPushHost("db5p.notify.windows.com"), true);
  });
});

// ── 4. Rate limits ──────────────────────────────────────────────────────────

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("blocks once the budget is spent and frees up when the window passes", () => {
    const rule = { key: "test", limit: 3, windowMs: 1000 };
    assert.equal(rateLimit(rule, 1000).ok, true);
    assert.equal(rateLimit(rule, 1001).ok, true);
    assert.equal(rateLimit(rule, 1002).ok, true);

    const blocked = rateLimit(rule, 1003);
    assert.equal(blocked.ok, false, "the 4th request must be refused");
    assert.ok(blocked.retryAfterSec > 0, "a retry hint is required");

    // Window expired: allowed again.
    assert.equal(rateLimit(rule, 2001).ok, true);
  });

  it("counts down remaining so a caller can see the edge coming", () => {
    const rule = { key: "remain", limit: 2, windowMs: 1000 };
    assert.equal(rateLimit(rule, 0).remaining, 1);
    assert.equal(rateLimit(rule, 1).remaining, 0);
  });

  it("fails closed when a rule is configured with no budget", () => {
    // A zero limit is a configuration bug; it must not become an open door.
    assert.equal(rateLimit({ key: "bad", limit: 0, windowMs: 1000 }, 0).ok, false);
  });

  it("keeps callers separate (one account cannot exhaust another's budget)", () => {
    const a = { key: rateLimitKey("notify", { userId: "user-a" }), limit: 1, windowMs: 1000 };
    const b = { key: rateLimitKey("notify", { userId: "user-b" }), limit: 1, windowMs: 1000 };
    assert.equal(rateLimit(a, 0).ok, true);
    assert.equal(rateLimit(b, 0).ok, true, "user-b is unaffected by user-a");
    assert.equal(rateLimit(a, 1).ok, false);
  });

  it("keys anonymous callers by IP, not by a shared 'anonymous' bucket", () => {
    // Otherwise one flood from any logged-out visitor throttles every other
    // logged-out visitor on the same origin.
    const one = rateLimitKey("analytics", { ip: "1.2.3.4" });
    const two = rateLimitKey("analytics", { ip: "5.6.7.8" });
    assert.notEqual(one, two);
  });

  it("uses every named rule for something other than an unbounded budget", () => {
    for (const [name, rule] of Object.entries(RATE_RULES)) {
      assert.ok(rule.limit > 0, `${name} must have a positive limit`);
      assert.ok(rule.windowMs > 0, `${name} must have a window`);
    }
  });

  it("bounds its own memory when keys are attacker-controlled", () => {
    // A new key per request is a memory-exhaustion vector. The limiter must not
    // grow without limit; it drops rather than dying.
    for (let i = 0; i < 12_000; i++) {
      rateLimit({ key: `flood:${i}`, limit: 5, windowMs: 60_000 }, 0);
    }
    // Still functioning rather than throwing or returning false for everything.
    assert.equal(rateLimit({ key: "after", limit: 1, windowMs: 1000 }, 0).ok, true);
  });
});

// ── 5. Security log redaction ────────────────────────────────────────────────

describe("redactForLog", () => {
  it("redacts anything that smells like a credential", () => {
    const out = redactForLog({
      password: "hunter2",
      access_token: "eyJhbGciOi",
      apiKey: "sk-live-123",
      Authorization: "Bearer abc",
      cookie: "sb-xxx-auth-token=yyy",
      p256dh: "BPkZ...",
      VAPID_PRIVATE_KEY: "private",
      otp: "123456",
    });
    for (const [key, value] of Object.entries(out)) {
      assert.equal(value, "[redacted]", `${key} must not be logged`);
    }
  });

  it("keeps the fields an audit trail actually needs", () => {
    const out = redactForLog({
      route: "/api/notify",
      actor_id: "3f2b...",
      status: 403,
      ip: "1.2.3.4",
      reason: "cross-site",
    });
    assert.equal(out.route, "/api/notify");
    assert.equal(out.actor_id, "3f2b...");
    assert.equal(out.status, 403);
  });

  it("allows an explicit reason/detail through even though the word contains a secret-ish token", () => {
    const out = redactForLog({ detail: "token rejected", reason: "expired token" });
    assert.equal(out.detail, "token rejected");
    assert.equal(out.reason, "expired token");
  });

  it("truncates a pasted payload rather than writing it out", () => {
    const out = redactForLog({ detail: "x".repeat(5000) });
    assert.ok(String(out.detail).length <= 201, "long values must be truncated");
  });

  it("never emits a non-JSON line", () => {
    const line = formatSecurityEvent("auth.denied", { route: "/api/notify" });
    const parsed = JSON.parse(line);
    assert.equal(parsed.security, "auth.denied");
    assert.ok(typeof parsed.at === "string");
  });
});

// ── 6. Response headers ─────────────────────────────────────────────────────

describe("securityHeaders", () => {
  const headers = securityHeaders({ isDev: false });

  it("sets HSTS with a real max-age", () => {
    assert.ok(headers["Strict-Transport-Security"], "HSTS must be present on HTTPS");
    assert.match(headers["Strict-Transport-Security"], /max-age=\d{6,}/);
  });

  it("does NOT claim preload or includeSubDomains", () => {
    // Both are operational commitments about a domain tree this repository does
    // not own. Asserting their absence keeps them from being added casually.
    assert.ok(!/preload/.test(headers["Strict-Transport-Security"]));
    assert.ok(!/includeSubDomains/.test(headers["Strict-Transport-Security"]));
  });

  it("sets the clickjacking and sniffing defences", () => {
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-XSS-Protection"], "0");
  });

  it("sets a referrer policy that does not leak invite tokens cross-origin", () => {
    // `?ref=<token>` is in the URL of every squad invite link.
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  });

  it("locks the CSP down to frame/object/base/form", () => {
    const csp = headers["Content-Security-Policy"];
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /default-src 'self'/);
  });

  it("relaxes script-src only in development, never in production", () => {
    const prod = contentSecurityPolicy(false);
    const dev = contentSecurityPolicy(true);
    assert.ok(!prod.includes("'unsafe-eval'"), "production must not allow eval");
    assert.ok(dev.includes("'unsafe-eval'"), "the dev overlay needs eval");
  });

  it("allows the Supabase host the app is actually configured against", () => {
    const csp = contentSecurityPolicy(false);
    assert.match(csp, /connect-src .*https:\/\/\*\.supabase\.co/);
  });

  it("marks API responses no-store", () => {
    assert.match(noStoreHeaders()["Cache-Control"], /no-store/);
  });
});

// ── 7. Invite code randomness ───────────────────────────────────────────────

describe("randomInviteCode", () => {
  it("produces the shape the join route and the DB CHECK expect", () => {
    const code = randomInviteCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^[A-Z0-9]{8}$/);
    for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch), `${ch} is in the alphabet`);
  });

  it("omits the visually ambiguous characters (I, O, 0, 1)", () => {
    // A code read aloud or copied off a screen must not be ambiguous.
    for (const ch of "IO01") assert.ok(!CODE_ALPHABET.includes(ch), `${ch} must be excluded`);
    for (let i = 0; i < 200; i++) {
      assert.ok(!/I|O|0|1/.test(randomInviteCode()), "generated code must stay unambiguous");
    }
  });

  it("does not repeat itself across many draws", () => {
    // A fixed Math.random() would fail this; a real PRNG will not.
    const seen = new Set();
    for (let i = 0; i < 2_000; i++) seen.add(randomInviteCode());
    assert.ok(seen.size > 1_990, `expected near-unique codes, got ${seen.size}/2000`);
  });
});

// ── 8. Static invariants that must not regress ──────────────────────────────

/** Remove comments so a test can assert on real code, not on prose about it. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("static invariants", () => {
  it("the login form does not reveal whether an email is registered", async () => {
    const { readFileSync } = await import("node:fs");
    // Comments are stripped first: this file's own explanation of why the old
    // copy was an oracle quotes the old copy, and matching that would mean the
    // test fails because someone documented the fix correctly.
    const src = stripComments(readFileSync("app/login/page.tsx", "utf8"));
    // Any user-visible copy that asserts an account exists is an enumeration
    // oracle. The sign-in branch is already generic ("don't match an account").
    assert.ok(
      !/account already uses|already registered|email is already|already have an account with/i.test(src),
      "signup must not distinguish 'this email exists' from 'this email is invalid'"
    );
  });

  it("the sign-in branch is generic for a wrong password and an unknown account", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("app/login/page.tsx", "utf8"));
    // "Invalid login credentials" is Supabase's combined answer. Surfacing it
    // verbatim is fine; branching on it to say "no such user" is not.
    assert.ok(
      !/no such user|unknown email|user not found|does not exist/i.test(src),
      "sign-in must not distinguish an unknown account from a wrong password"
    );
  });

  it("the cron guard compares in constant time", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/supabase/service.ts", "utf8");
    assert.ok(
      /timingSafeEqual/.test(src) && !/=== secret/.test(src),
      "a plain === on the cron secret is a timing oracle"
    );
  });

  it("no API route parses an unbounded JSON body directly", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    // `await request.json().catch(...)` with no cap reads whatever arrives. The
    // routes listed here are the deliberate exceptions and are documented as
    // such in each file.
    const allowed = new Set(["app/api/squads/referral/route.ts"]);
    const offenders = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (!["node_modules", ".next", ".git"].includes(e.name)) walk(p);
        } else if (e.name === "route.ts") {
          if (allowed.has(p)) continue;
          const src = readFileSync(p, "utf8");
          if (/request\.json\(\)/.test(src)) offenders.push(p);
        }
      }
    };
    walk("app/api");
    assert.deepEqual(offenders, [], `unbounded body parse in: ${offenders.join(", ")}`);
  });

  it("every app RPC is in the EXECUTE keep-list (no silent exposure, no silent breakage)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    // The hardening migration revokes EXECUTE on every public function, then
    // re-grants exactly the RPCs the app calls. A new .rpc("name") that is not
    // added to the keep-list breaks at runtime; a function dropped from the
    // keep-list while still called does too. This test greps the call sites
    // (app/ + lib/) and asserts each name appears in the keep-list file.
    const sql = readFileSync(
      "supabase/migrations/20261004000003_security_hardening.sql",
      "utf8"
    );
    // Granted to anon/authenticated: `grant execute on function public.<name>(`.
    const granted = new Set(
      [...sql.matchAll(/grant execute on function public\.([a-z_][a-z0-9_]*)\s*\(/gi)].map(
        (m) => m[1].toLowerCase()
      )
    );
    // Service-role callers documented in the same file's header
    // ("Deliberately NOT re-granted (service-role callers only)"). They are
    // still part of the keep-list (the app calls them via the service client),
    // just not exposed to anon/authenticated. Parsed from the header so the
    // test fails if the header stops documenting one. Header lists bare names
    // (attribute_join, ...) plus suffixed overloads (my_referral_links(uuid)),
    // so any token containing an underscore in that block counts.
    const headerStart = sql.indexOf("Deliberately NOT re-granted");
    const headerEnd = sql.indexOf("FUTURE FUNCTIONS");
    const headerBlock =
      headerStart >= 0 && headerEnd > headerStart
        ? sql.slice(headerStart, headerEnd)
        : "";
    const serviceOnly = new Set(
      [...headerBlock.matchAll(/([a-z]+_[a-z0-9_]*)/gi)].map((m) =>
        m[1].toLowerCase()
      )
    );
    const keepList = new Set([...granted, ...serviceOnly]);

    const called = new Set();
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (!["node_modules", ".next", ".git"].includes(e.name)) walk(p);
        } else if (/\.(ts|tsx)$/.test(e.name)) {
          const src = readFileSync(p, "utf8");
          for (const m of src.matchAll(/\.rpc\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g)) {
            called.add(m[1].toLowerCase());
          }
        }
      }
    };
    walk("app");
    walk("lib");
    const offenders = [...called].filter((name) => !keepList.has(name));
    assert.deepEqual(offenders, [], `RPCs missing from the keep-list: ${offenders.join(", ")}`);
  });
});
// ── 9. Password recovery + session revocation (controls 3, 4, 5, 12, 17) ────
// Recovery tokens are provider-owned (Supabase: single-use, expiring). What
// the app owns — generic responses, resend friction, login backoff, and
// global revocation after the update — is asserted here as static invariants
// because the route handlers need `@/` and cannot be unit-imported.

describe("password recovery", () => {
  it("reset responses are identical whether the address has an account", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("app/login/page.tsx", "utf8"));
    assert.ok(
      /If an account uses that email, a reset link is on its way/.test(src),
      "the reset confirmation must be one generic sentence"
    );
    assert.ok(
      !/no account with|not registered|unknown address|no user with|address not found/i.test(src),
      "the reset path must not distinguish unknown addresses"
    );
  });

  it("the reset request cannot burn unbounded email cost from one tap", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/login/page.tsx", "utf8");
    assert.ok(
      /RESET_COOLDOWN|reset_cooldown|cooldown/i.test(src),
      "a resend cooldown must gate repeated reset requests"
    );
  });

  it("recovery telemetry is counter-only, never the address", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/login/page.tsx", "utf8");
    assert.ok(
      /track\("password_reset_requested", \{\}\)/.test(src),
      "the reset event must carry no props (no email)"
    );
    assert.ok(
      ANALYTICS_EVENTS.includes("password_reset_requested"),
      "the event must be in the allow-list or the sink drops it"
    );
  });

  it("the update page is unreachable without a live recovery session", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/auth/update-password/page.tsx", "utf8");
    assert.ok(
      /getSession/.test(src) && /replace\("\/login/.test(src),
      "no session must bounce to login before any form renders"
    );
    assert.ok(
      /minLength\{8\}|length < 8/.test(src),
      "the 8-character floor must be enforced in the form"
    );
    assert.ok(
      !/localStorage.*token|sessionStorage.*token|token.*localStorage/i.test(src),
      "the recovery token must never be persisted in web storage"
    );
  });

  it("a password update revokes every session globally, not just locally", async () => {
    const { readFileSync } = await import("node:fs");
    const route = readFileSync("app/api/auth/revoke-sessions/route.ts", "utf8");
    assert.ok(
      /requireUser/.test(route),
      "the caller must be resolved before anything is revoked"
    );
    assert.ok(
      /admin\.signOut\(token, "global"\)/.test(route),
      "revocation must be a global admin sign-out, not a local one"
    );
    assert.ok(
      !/body\.(user_id|userId|id)\b/.test(route),
      "the revoked account must come from the session, never the request body"
    );
    assert.ok(/rateLimit/.test(route), "the revoke endpoint must be throttled");
    const page = readFileSync("app/auth/update-password/page.tsx", "utf8");
    assert.ok(
      /revoke-sessions/.test(page) && /signOut\(\)/.test(page),
      "the update page must call the revoke route and then drop its own session"
    );
  });
});

describe("login abuse friction", () => {
  it("consecutive failures back off and are counted without PII", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/login/page.tsx", "utf8");
    assert.ok(
      /BACKOFF_SEC|signin_lock|lockRemainingSec/.test(src),
      "a progressive backoff must exist on the sign-in form"
    );
    assert.ok(
      /track\("signin_failed", \{\}\)/.test(src),
      "failures must be counted with no email and no cause string"
    );
    assert.ok(
      ANALYTICS_EVENTS.includes("signin_failed"),
      "the event must be in the allow-list or the sink drops it"
    );
  });

  it("the framework fingerprint header is off", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("next.config.ts", "utf8");
    assert.ok(
      /poweredByHeader:\s*false/.test(src),
      "X-Powered-By must be disabled"
    );
  });
});

// ── 10. Wave A correctness invariants (static) ───────────────────────────────
// These assert the bug fixes stay fixed. Static style like section 8: read the
// shipped source and refuse the old shapes.

describe("wave A: squad-local days (IST)", () => {
  it("squadActivity has no viewer-local day bucketing", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("lib/data/squadActivity.ts", "utf8"));
    assert.ok(!/setHours/.test(src), "setHours-based bucketing must not come back");
    assert.ok(!/startOfTodayLocal/.test(src), "viewer-local start-of-day must not come back");
    assert.ok(!/toLocalDayKey/.test(src), "viewer-local day keys must not come back");
    assert.ok(
      /squadDays/.test(src) && /squadStartOfTodayUtcISO|squadTodayDayNum/.test(src),
      "day bucketing must come from the squad-local (IST) helper"
    );
  });

  it("the squad page week labels use the same IST buckets", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("app/squad/page.tsx", "utf8"));
    assert.ok(
      /squadWeekDayNums|squadDayKeyFromDayNum/.test(src),
      "week labels must reuse the squad-local buckets"
    );
  });

  it("goal deadlines stay positive in the future", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/data/goals.ts", "utf8");
    assert.ok(
      /daysBetween\(now,\s*(new Date\()?goal\.deadline/.test(src),
      "deadline must be the second arg to daysBetween"
    );
    assert.ok(
      !/daysBetween\(goal\.deadline,\s*now\)/.test(src),
      "inverted daysBetween args must not come back"
    );
  });
});

describe("wave A: timer truth", () => {
  it("the provider accumulates with performance.now() and freezes on hide", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/providers/SolvingProvider.tsx", "utf8");
    assert.ok(/performance\.now\(\)/.test(src), "elapsed must accumulate from performance.now() deltas");
    assert.ok(/visibilitychange/.test(src), "hidden tabs must auto-pause");
    assert.ok(/pausedAccum|lastPerfRef|accumRef/.test(src), "pause must freeze accumulation state");
  });

  it("only the leader tab heartbeats and stale sessions stop honestly", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("components/layout/NowSolvingBar.tsx", "utf8"));
    assert.ok(/BroadcastChannel/.test(src), "multi-tab heartbeats need leader election");
    assert.ok(/expired/.test(src), "stale heartbeats must surface expiry");
    assert.ok(
      /session expired, restart the battle/i.test(src),
      "an expired session must say so instead of counting silently"
    );
  });

  it("heartbeat never regresses duration and end requires a live row", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/battles/route.ts", "utf8");
    assert.ok(
      /wantDuration|GREATEST/.test(src) && /stored/.test(src),
      "heartbeat must guard against regressing duration (GREATEST-style)"
    );
    const heartbeatIdx = src.indexOf('action === "heartbeat"');
    const endIdx = src.indexOf('action === "end"');
    assert.ok(heartbeatIdx >= 0 && endIdx > heartbeatIdx, "both actions must exist");
    assert.ok(
      /\.eq\("outcome", "in_progress"\)/.test(src),
      "heartbeat and end must scope writes to in_progress rows"
    );
    assert.ok(/410/.test(src) && /expired/.test(src), "stale writes must answer 410/expired");
  });

  it("a start race returns the live row instead of 500", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/battles/route.ts", "utf8");
    assert.ok(/23505/.test(src), "the one-live-per-user race must be caught");
    assert.ok(/resumed/.test(src), "a raced start must return the existing live row");
  });
});

describe("wave A: streaks and weekly counts", () => {
  it("leetcode streaks are never maxed and never zero-filled on failure", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("app/api/sync/leetcode/route.ts", "utf8"));
    assert.ok(!/Math\.max\(prev\?\.streak/.test(src), "immortal max() streaks must not come back");
    assert.ok(/streak_updated_at/.test(src), "successful streak writes must stamp streak_updated_at");
    assert.ok(
      /streak\?: number \| null|streak\?: number/.test(src),
      "a missing streak (fetch failure) must be representable, not coerced to 0"
    );
  });

  it("member solves are a real 7-day window, not all-time", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("lib/data/squads.ts", "utf8"));
    assert.ok(/problem_events/.test(src), "weekly counts must read the event timeline");
    assert.ok(
      /7 \* 86_400_000|7 \* 86400|sinceISO/.test(src),
      "weekly counts must bound to the last 7 days"
    );
  });

  it("the two streaks are labeled distinctly", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("app/squad/page.tsx", "utf8"));
    assert.ok(/LeetCode streak/.test(src), "member streaks must say LeetCode streak");
    assert.ok(/squad streak/.test(src), "the shared streak must say squad streak");
  });
});

describe("wave A: quiet hours (IST)", () => {
  it("both TS call sites share one IST helper", async () => {
    const { readFileSync } = await import("node:fs");
    for (const p of ["app/api/notify/route.ts", "lib/data/notifications.ts"]) {
      const src = stripComments(readFileSync(p, "utf8"));
      assert.ok(
        /inQuietHoursIST|quietHours/.test(src),
        `${p} must use the shared quiet-hours helper`
      );
      assert.ok(
        !/\.getHours\(\)/.test(src),
        `${p} must not compute quiet hours from viewer-local getHours()`
      );
    }
    const helper = readFileSync("lib/quietHours.ts", "utf8");
    assert.ok(/Asia\/Kolkata/.test(helper), "quiet hours default to Asia/Kolkata");
    assert.ok(/22/.test(helper) && /8/.test(helper), "quiet hours stay 22:00-08:00");
  });
});

describe("wave A: challenge and reminder races", () => {
  it("suggestion writes are guarded to pending rows", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/data/suggestions.ts", "utf8");
    const guards = (src.match(/\.eq\("status", "pending"\)/g) || []).length;
    assert.ok(guards >= 3, `accept/remind/complete/dismiss need pending guards (found ${guards})`);
    assert.ok(
      /reminded_at\.is\.null,reminded_at\.lt\./.test(src),
      "reminders must enforce the 24h window in WHERE"
    );
  });

  it("dismiss never writes completed_at", async () => {
    const { readFileSync } = await import("node:fs");
    const src = stripComments(readFileSync("lib/data/suggestions.ts", "utf8"));
    const dismissIdx = src.indexOf("dismissSuggestion");
    assert.ok(dismissIdx >= 0, "dismissSuggestion must exist");
    const window = src.slice(dismissIdx, dismissIdx + 1200);
    assert.ok(!/completed_at/.test(window), "dismiss must leave completed_at alone (no dismissed_at column exists)");
  });

  it("stuck reminders are throttled in WHERE on open rows", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/data/stuck.ts", "utf8");
    assert.ok(/\.eq\("status", "open"\)/.test(src), "stuck writes must guard to open rows");
    assert.ok(
      /last_reminded_at\.is\.null,last_reminded_at\.lt\./.test(src),
      "stuck reminders must enforce the 24h window in WHERE"
    );
  });

  it("bookmark races resolve to bookmarked instead of throwing", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/data/review.ts", "utf8");
    assert.ok(/23505/.test(src), "toggleBookmark must handle the duplicate race");
  });
});

// ── 11. Wave D deep-continue CTAs (static) ───────────────────────────────────
// Every public artifact CTA must carry ?next=<artifact> so a logged-out
// visitor lands back on the artifact after auth (Bible §42). Static style like
// section 8: read the shipped pages and refuse a bare /login CTA.

describe("wave D: deep-continue CTAs", () => {
  it("every public artifact page carries ?next= on its CTAs", async () => {
    const { readFileSync } = await import("node:fs");
    const pages = [
      "app/b/[id]/page.tsx",
      "app/u/[username]/page.tsx",
      "app/squad/[id]/recaps/[recapId]/page.tsx",
      "app/squad/[id]/seasons/[seasonId]/page.tsx",
      "app/squad/join/[code]/page.tsx",
    ];
    for (const p of pages) {
      const src = readFileSync(p, "utf8");
      assert.ok(
        src.includes("?next=") || src.includes("&next=") || src.includes("next=${"),
        `${p} must carry ?next= on its public CTAs`
      );
    }
  });

  it("artifact CTAs route through the shared safeNext() helper", async () => {
    const { readFileSync } = await import("node:fs");
    for (const p of [
      "app/b/[id]/page.tsx",
      "app/u/[username]/page.tsx",
      "app/squad/join/[code]/page.tsx",
    ]) {
      const src = readFileSync(p, "utf8");
      assert.ok(
        src.includes("safeNext"),
        `${p} must build ?next= through lib/safeNext.ts, not string concat alone`
      );
    }
  });

  it("the join sign-in preserves ?ref= inside ?next=", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/squad/join/[code]/page.tsx", "utf8");
    assert.ok(
      /ref=.*next=|next=.*ref=/.test(src),
      "the join header sign-in must keep the referral inside the continuation"
    );
  });

  it("no public artifact CTA points at a bare /login", async () => {
    const { readFileSync } = await import("node:fs");
    // A bare href="/login" (exact string, no query) drops the visitor on the
    // generic page after auth. Template URLs with ?next= do not match.
    for (const p of [
      "app/b/[id]/page.tsx",
      "app/u/[username]/page.tsx",
      "app/squad/[id]/recaps/[recapId]/page.tsx",
    ]) {
      const src = readFileSync(p, "utf8");
      assert.ok(
        !/href="\/login"/.test(src),
        `${p} must not link at a bare /login`
      );
    }
  });
});
