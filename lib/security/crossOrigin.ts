/**
 * Cross-site request forgery guard for cookie-authenticated API calls.
 *
 * Pure and alias-free so it runs in the edge middleware and is unit-testable
 * without a server.
 *
 * Why this exists when the Supabase session cookie is already `SameSite=Lax`:
 * `SameSite` is defence in depth, not a substitute. It does not apply to a
 * request that carries an `Authorization` header (nothing to do with cookies),
 * it is not honoured by every client, and it says nothing about the *other*
 * cookie-authenticated surfaces this app will grow. The invariant worth
 * enforcing is simply: a state-changing API call that declares itself
 * cross-site, or arrives from an origin we do not recognise, does not get to
 * run.
 *
 * What it deliberately does NOT do:
 *
 *   - Reject a request with no `Origin` header. Scheduled jobs, `curl`, the
 *     server-to-server cron calls and mobile clients all omit it, and they
 *     authenticate with a bearer token that a browser cannot forge
 *     cross-origin anyway. Rejecting them would break the product to buy
 *     nothing.
 *   - Replace `SameSite`. Both.
 */

export interface CrossOriginCheckInput {
  method: string;
  pathname: string;
  /** The `Origin` request header, or null when absent. */
  origin: string | null;
  /** The `Sec-Fetch-Site` request header, when the browser sent one. */
  secFetchSite: string | null;
  /** Scheme + host this request was addressed to, e.g. `https://mahayuddh.app`. */
  requestOrigin: string;
  /** Extra origins the app genuinely accepts, from configuration. */
  allowedOrigins: readonly string[];
  /**
   * True when the request carries a non-empty `Authorization: Bearer` token.
   *
   * Bearer credentials are never ambient: a cross-site attacker cannot attach
   * the victim's token (it lives in same-origin storage, and setting the
   * header cross-origin fails preflight without our opt-in). So a request
   * presenting one is either first-party code or the token holder — and the
   * route still validates it (invalid → 401). The Origin check adds nothing
   * for such requests, while privacy browsers (Brave shields), in-app
   * webviews, and sandboxed previews legitimately anonymise Origin. Cookie-
   * only or anonymous anonymised requests stay rejected, where ambient
   * credentials are actually at stake.
   */
  hasBearer?: boolean;
}

export interface CrossOriginVerdict {
  ok: boolean;
  /** Machine-readable reason, logged rather than shown to the caller. */
  reason: string | null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Normalise `https://Host:443/` and `https://host` to one comparable string. */
export function normalizeOrigin(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === "null") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
  } catch {
    return null;
  }
}

/**
 * Parse `ALLOWED_ORIGINS` (comma or whitespace separated) into normalised
 * origins, dropping anything that is not an absolute http(s) origin.
 *
 * An operator who fat-fingers this gets an empty allowlist, which degrades to
 * "same-origin only" rather than to "everything is allowed".
 */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    if (!part) continue;
    const normalized = normalizeOrigin(part);
    if (normalized) out.push(normalized);
  }
  return Array.from(new Set(out));
}

export function checkCrossOriginRequest(input: CrossOriginCheckInput): CrossOriginVerdict {
  if (SAFE_METHODS.has(input.method.toUpperCase())) {
    return { ok: true, reason: null };
  }

  // Page routes are navigations and reads. Only the API surface mutates.
  if (!input.pathname.startsWith("/api")) {
    return { ok: true, reason: null };
  }

  // The header's presence and its parseability are different questions, and
  // collapsing them opens a hole: a sandboxed iframe, a `file://` page and a
  // `data:` document all send the literal string `Origin: null`. Treating that
  // as "no origin supplied" would wave through exactly the requests a browser
  // deliberately anonymises. So: absent header -> non-browser client; present
  // but unparseable -> refused.
  const rawOrigin = input.origin?.trim();
  if (rawOrigin === undefined || rawOrigin === "") {
    // No Origin and no cross-site declaration: a non-browser client. Authorisation
    // is still enforced inside each route.
    return { ok: true, reason: null };
  }

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) {
    return bearerBypass(input, `origin not parseable: ${rawOrigin.slice(0, 64)}`);
  }

  const requestOrigin = normalizeOrigin(input.requestOrigin);
  if (origin === requestOrigin) {
    return { ok: true, reason: null };
  }

  const allowed = input.allowedOrigins
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value));
  if (allowed.includes(origin)) {
    return { ok: true, reason: null };
  }

  return bearerBypass(input, `origin not allowed: ${origin}`);
}

/** Reason prefix marking a pass granted by the bearer bypass (never a block). */
export const BEARER_BYPASS_PREFIX = "bearer-present";

/**
 * Anonymised-origin escape hatch. See `hasBearer` for the threat model:
 * bearer-present requests are CSRF-immune by construction, so a rejection
 * grounded only in the origin becomes an audit line instead of a block.
 */
function bearerBypass(input: CrossOriginCheckInput, reason: string): CrossOriginVerdict {
  if (input.hasBearer) {
    return { ok: true, reason: `${BEARER_BYPASS_PREFIX}, origin check skipped (${reason})` };
  }
  return { ok: false, reason };
}

/**
 * Is this request one the browser itself flagged as cross-site?
 *
 * Separate from the verdict above because an allowlisted origin is legitimately
 * cross-site: the LeetCode bookmarklet runs on leetcode.com and calls this
 * origin's API. `Sec-Fetch-Site: cross-site` is therefore not a verdict on its
 * own — it is the backstop for the case where a browser sends it but no usable
 * `Origin` (or one that was stripped in transit), which is exactly the shape a
 * CSRF attempt takes and the shape a configured integration never takes.
 *
 * `middleware.ts` applies this after the allowlist check, so a configured
 * origin is allowed through and everything else cross-site is not.
 */
export function isDeclaredCrossSite(secFetchSite: string | null): boolean {
  return (secFetchSite ?? "").trim().toLowerCase() === "cross-site";
}