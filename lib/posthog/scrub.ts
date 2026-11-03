/**
 * Remove credentials from anything sent to PostHog. API calls in this app
 * carry `Authorization: Bearer <access token>`; an error message or stack
 * that echoes a header, a URL with a token, or a JWT must never leave the
 * browser or the server. Walks strings, arrays and plain objects.
 */
const PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]"],
  [/([?&](?:access_token|refresh_token|token|code|token_hash)=)[^&#\s"']+/gi, "$1[redacted]"],
  [/\b(sb_secret_|sb_publishable_|phx_)[A-Za-z0-9_-]+/g, "$1[redacted]"],
];

export function scrubString(s: string): string {
  return PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), s);
}

export function scrub<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return scrubString(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /^authorization$|^cookie$|^x-mahayuddh-token$/i.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out as T;
  }
  return value;
}
