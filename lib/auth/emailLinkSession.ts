/**
 * Did this session come from an emailed one-time link, recently?
 *
 * Supabase records how a session was authenticated in the access token's
 * `amr` claim (authentication methods reference), e.g.
 *   [{ "method": "otp", "timestamp": 1793686216 }]
 * An emailed link verified by token hash (/auth/confirm) records "otp"; the
 * older PKCE recovery link records "recovery". A password, OAuth or refreshed
 * session records neither as its latest method.
 *
 * `amr` is a JWT claim, not a field of the user object: reading
 * `user.amr` always gives undefined. That made the password-reset form reject
 * every reset link before this helper existed.
 */
export const EMAIL_LINK_MAX_AGE_S = 15 * 60;

type Amr = { method?: string; timestamp?: number } | string;

function decodeClaims(accessToken: string): { amr?: Amr[] } | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json =
      typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * True when the token's authentication includes an emailed link ("otp" or
 * "recovery") no older than `maxAgeS` seconds at `nowS`.
 */
export function isRecentEmailLinkSession(
  accessToken: string | null | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
  maxAgeS: number = EMAIL_LINK_MAX_AGE_S
): boolean {
  if (!accessToken) return false;
  const amr = decodeClaims(accessToken)?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (typeof entry === "string") return entry === "recovery" || entry === "otp";
    const method = entry?.method;
    const ts = entry?.timestamp;
    if (method !== "recovery" && method !== "otp") return false;
    return typeof ts === "number" && nowS - ts >= -60 && nowS - ts <= maxAgeS;
  });
}
