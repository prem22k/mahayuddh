/**
 * Decode a dynamic route segment before using it as a database key.
 *
 * Next.js hands a dynamic segment to the page STILL PERCENT-ENCODED. Verified
 * against the live app with an isolated route:
 *
 *     /dbgseg/abc        -> param "abc"          len 3
 *     /dbgseg/abc%20def  -> param "abc%20def"   len 9   <- not decoded
 *     /dbgseg/abc+def    -> param "abc%2Bdef"   len 9   <- the + was escaped
 *
 * So `app/u/[username]` was looking up the literal string "Prem Sai" and
 * finding nothing, and `/u/Prem%20Sai` returned 404 for every handle
 * containing a space — and for every handle containing `%`, `+`, `#`, `&` or
 * any non-ASCII character, since those are all encoded too. Verified on the
 * live site before the fix:
 *
 *     /u/prajwal       -> 200
 *     /u/MixedCase     -> 404   (capital, encoded)
 *     /u/Prem%20Sai    -> 404   (space)
 *
 * A public profile is not decoration: §22's dimensions, the teaching list,
 * follows, referrals and "who recruited you" all hang off this page.
 *
 * `app/patterns/[topic]` already decoded its own segment — so this was learned
 * once and never applied again. Hence a shared helper.
 *
 * Three things a bare `decodeURIComponent` gets wrong, all handled here:
 *
 *   - It THROWS on a malformed sequence. `/u/100%` is a 500, not a 404. A junk
 *     URL should not be able to take a page down.
 *   - It is not idempotent for `%`, so it must run exactly once. The first
 *     draft guarded against a second pass by refusing to decode any value
 *     containing "%25" — which broke every handle containing a literal `%`,
 *     because encodeURIComponent encodes that to "%25". The guard was solving
 *     a problem that a single call does not have: one decode of "%2520" already
 *     yields the literal text "%20", not a space. Removed, and the round trip
 *     now holds.
 *   - It turns an encoded `%2F` into a real slash, which is a path the segment
 *     was never allowed to contain. Refused rather than silently turned into
 *     something that could reach a different route.
 *
 * `+` is deliberately left alone: in a path segment it is a literal plus, and
 * only a query string treats it as a space.
 */

export function decodePathSegment(raw: string | undefined | null): string {
  if (typeof raw !== "string" || raw.length === 0) return "";

  // Exactly one decode. Never call this twice on the same value: a second pass
  // would turn "%2520" into a space instead of the literal text "%20".
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed: "/u/100%" or a truncated escape. The raw value is the best
    // available key, and a lookup that misses produces an honest 404.
    return raw;
  }

  // An encoded slash means this was never a single segment.
  if (decoded.includes("/")) return raw;

  return decoded;
}
