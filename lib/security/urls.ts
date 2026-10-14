/**
 * URL validation for user-supplied links (Wave B trust-hardening).
 *
 * Two surfaces:
 *   - profiles.avatar_url: OAuth / LeetCode picture URLs rendered directly in
 *     <img>. https-only + host allowlist. The allowlist reuses Next's
 *     images.remotePatterns in next.config.ts so the validator and the image
 *     optimizer never disagree about which hosts are renderable.
 *   - shared_resources.external_url: vault links. https-only (any host — vault
 *     articles can point anywhere), rejecting javascript:/data:/file: and
 *     unparseable input.
 *
 * Alias-free so routes and lib/data can import it, and so the static security
 * tests can import it without `@/`.
 */

export const AVATAR_HOSTS = [
  "assets.leetcode.com",
  "leetcode.com",
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
] as const;

const AVATAR_HOST_SET = new Set<string>(AVATAR_HOSTS.map((h) => h.toLowerCase()));

/** Anything enormous is not a URL we want to store. */
const MAX_URL_CHARS = 2048;

export type UrlRejection = "unparseable" | "not_https" | "host_not_allowed" | "too_long";

export interface UrlVerdict {
  ok: boolean;
  /** Canonical URL to store, present only when ok. */
  url: string | null;
  reason: UrlRejection | null;
}

function tooLong(value: string): boolean {
  return value.length > MAX_URL_CHARS;
}

function parseHttps(value: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return parsed;
}

/**
 * Avatar URLs: https-only + exact-host allowlist.
 *
 * Exact match (no suffix tricks): `leetcode.com.evil.com` must not pass
 * because it ends with an allowed host without being it.
 */
export function isAllowedAvatarHost(host: string): boolean {
  return AVATAR_HOST_SET.has(host.toLowerCase());
}

export function validateAvatarUrl(raw: unknown): UrlVerdict {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, url: null, reason: "unparseable" };
  }
  const value = raw.trim();
  if (tooLong(value)) return { ok: false, url: null, reason: "too_long" };
  const parsed = parseHttps(value);
  if (!parsed) {
    // Distinguish scheme failures from garbage for the caller, but both reject.
    try {
      new URL(value);
      return { ok: false, url: null, reason: "not_https" };
    } catch {
      return { ok: false, url: null, reason: "unparseable" };
    }
  }
  if (!isAllowedAvatarHost(parsed.hostname)) {
    return { ok: false, url: null, reason: "host_not_allowed" };
  }
  return { ok: true, url: parsed.toString(), reason: null };
}

/**
 * Vault external URLs: https-only, any host.
 *
 * No host allowlist on purpose: a vault article can legitimately link anywhere
 * (docs, blogs, videos). The control that matters is scheme — no javascript:,
 * data:, file:, or http: that downgrades the page — plus parseability and size.
 */
export function validateExternalUrl(raw: unknown): UrlVerdict {
  if (raw == null) return { ok: true, url: null, reason: null };
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: true, url: null, reason: null };
  }
  const value = raw.trim();
  if (tooLong(value)) return { ok: false, url: null, reason: "too_long" };
  const parsed = parseHttps(value);
  if (!parsed) {
    try {
      new URL(value);
      return { ok: false, url: null, reason: "not_https" };
    } catch {
      return { ok: false, url: null, reason: "unparseable" };
    }
  }
  return { ok: true, url: parsed.toString(), reason: null };
}
