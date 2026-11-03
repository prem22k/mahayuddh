/**
 * Nothing sent to PostHog may carry a credential.
 * Run: node --no-warnings --test tests/posthog/scrub.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scrub, scrubString } from "../../lib/posthog/scrub.ts";
import { posthogAssetsHost } from "../../lib/posthog/config.ts";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

describe("scrub", () => {
  it("redacts bearer tokens, JWTs, token query params and Supabase keys", () => {
    const s = scrubString(`fetch failed: Authorization: Bearer ${JWT} /auth/callback?code=abc123&next=/home ${JWT} sb_secret_ABCdef123`);
    assert.doesNotMatch(s, /eyJhbGci/);
    assert.doesNotMatch(s, /abc123/);
    assert.doesNotMatch(s, /ABCdef123/);
    assert.match(s, /next=\/home/);
  });
  it("redacts header-like keys and walks nested objects and arrays", () => {
    const out = scrub({ headers: { Authorization: "Bearer x", Cookie: "sb=1" }, list: [`t ${JWT}`], n: 3, ok: true });
    assert.equal(out.headers.Authorization, "[redacted]");
    assert.equal(out.headers.Cookie, "[redacted]");
    assert.doesNotMatch(out.list[0], /eyJ/);
    assert.equal(out.n, 3);
    assert.equal(out.ok, true);
  });
  it("leaves ordinary text alone", () => {
    assert.equal(scrubString("Cannot read properties of undefined (reading 'id')"), "Cannot read properties of undefined (reading 'id')");
  });
});

describe("posthogAssetsHost", () => {
  it("maps the region ingestion host to its assets host", () => {
    assert.equal(posthogAssetsHost("https://eu.i.posthog.com"), "https://eu-assets.i.posthog.com");
    assert.equal(posthogAssetsHost("https://us.i.posthog.com"), "https://us-assets.i.posthog.com");
    assert.equal(posthogAssetsHost("https://ph.example.com"), "https://ph.example.com");
  });
});

describe("CSP allows PostHog only when configured", async () => {
  const { contentSecurityPolicy } = await import("../../lib/security/headers.ts");
  it("adds the ingestion and assets hosts from NEXT_PUBLIC_POSTHOG_HOST", () => {
    const saved = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    try {
      delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
      assert.doesNotMatch(contentSecurityPolicy(false), /posthog/);
      process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com/";
      const csp = contentSecurityPolicy(false);
      assert.match(csp, /connect-src [^;]*https:\/\/eu\.i\.posthog\.com/);
      assert.match(csp, /connect-src [^;]*https:\/\/eu-assets\.i\.posthog\.com/);
      assert.match(csp, /script-src [^;]*https:\/\/eu-assets\.i\.posthog\.com/);
      process.env.NEXT_PUBLIC_POSTHOG_HOST = "http://insecure.example";
      assert.doesNotMatch(contentSecurityPolicy(false), /insecure\.example/);
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST; else process.env.NEXT_PUBLIC_POSTHOG_HOST = saved;
    }
  });
});
