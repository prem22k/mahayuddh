/**
 * Read the claims of a Supabase access token WITHOUT verifying it.
 *
 * Only for tokens that were already verified (the server resolves the bearer
 * token with Supabase first) or for UX decisions in the browser. Never use the
 * result to decide who someone is.
 */
export type AmrEntry = { method?: string; timestamp?: number } | string;

export function decodeJwtClaims(accessToken: string | null | undefined): { amr?: AmrEntry[] } | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * When the session last proved who it is: the newest `amr` timestamp
 * (password, OAuth, emailed link). Refreshing a session keeps these, so a
 * week-old session refreshed a minute ago still answers a week ago.
 * Null when the token carries no timestamped methods.
 */
export function lastAuthenticatedAt(accessToken: string | null | undefined): number | null {
  const amr = decodeJwtClaims(accessToken)?.amr;
  if (!Array.isArray(amr)) return null;
  const times = amr
    .map((e) => (typeof e === "object" && typeof e?.timestamp === "number" ? e.timestamp : null))
    .filter((t): t is number => t !== null);
  return times.length ? Math.max(...times) : null;
}

/** Signed in (by any method) within `maxAgeS` seconds of `nowS`. */
export function isRecentSignIn(
  accessToken: string | null | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
  maxAgeS = 10 * 60
): boolean {
  const at = lastAuthenticatedAt(accessToken);
  return at !== null && nowS - at >= -60 && nowS - at <= maxAgeS;
}
