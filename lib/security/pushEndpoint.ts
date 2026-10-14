/**
 * Push subscription endpoint validation.
 *
 * The web-push endpoint is a URL the *browser* hands us, stored server-side, and
 * posted to by `web-push` on every notification. That combination makes it a
 * server-side request forgery primitive unless the URL is constrained: the
 * attacker picks the host, our server makes the request, and the response
 * status lands in a table the attacker can read back through `/api/push/deliver`.
 *
 * The previous check was `/^https:\/\/[a-z0-9.-]+\//i` with a comment claiming it
 * stopped the table being "used to make the server probe internal addresses". It
 * did not. `https://169.254.169.254/`, `https://localhost/` and
 * `https://metadata.google.internal/` all match it.
 *
 * The control that actually holds is an allowlist: the push services are a small,
 * known, vendor-owned set, and this app has no reason to POST a signed payload to
 * anything else. Everything not on the list is rejected at subscription time, so
 * an attacker cannot even get a request in flight.
 *
 * Alias-free so it is unit-testable and importable from a route handler.
 */

/**
 * Exact hosts, and suffix rules expressed as the suffix itself.
 *
 * Every browser push service this app can realistically receive an endpoint for:
 *   - Chrome / Edge / Firefox on Android  -> FCM
 *   - Firefox on desktop                 -> Mozilla autopush
 *   - Safari                             -> Apple Web Push
 *   - legacy Edge / WNS                  -> Windows Notification Service
 */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "update.push.services.mozilla.com",
  "web.push.apple.com",
]);

const HOST_SUFFIXES = [".notify.windows.com", ".push.services.mozilla.com"];

/** Endpoints carry a long opaque path; anything enormous is not one. */
const MAX_ENDPOINT_CHARS = 2048;

export type PushEndpointRejection = "unparseable" | "not_https" | "host_not_allowed" | "too_long";

export interface PushEndpointVerdict {
  ok: boolean;
  /** Canonical URL to store, present only when ok. */
  endpoint: string | null;
  reason: PushEndpointRejection | null;
}

/**
 * Is this host one of the known push services?
 *
 * Exported separately so the check is directly testable against the internal
 * address shapes that the old regex let through.
 */
export function isAllowedPushHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (EXACT_HOSTS.has(lower)) return true;
  return HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix) && lower.length > suffix.length);
}

export function validatePushEndpoint(raw: unknown): PushEndpointVerdict {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, endpoint: null, reason: "unparseable" };
  }

  const value = raw.trim();
  if (value.length > MAX_ENDPOINT_CHARS) {
    return { ok: false, endpoint: null, reason: "too_long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, endpoint: null, reason: "unparseable" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, endpoint: null, reason: "not_https" };
  }

  if (!isAllowedPushHost(parsed.hostname)) {
    return { ok: false, endpoint: null, reason: "host_not_allowed" };
  }

  // Canonical form so the same endpoint cannot be stored twice under two
  // spellings and defeat the `onConflict` upsert.
  return { ok: true, endpoint: parsed.toString(), reason: null };
}