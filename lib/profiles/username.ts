import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one way to find a profile by name.
 *
 * Three separate hand-written lookups had drifted into three different bugs:
 *
 *   profilePublic.ts / journey.ts   .eq("username", input.toLowerCase())
 *                                  → 404 for any stored name with a capital
 *   notebook.ts shareNoteWith       .eq("username", input.trim())
 *                                  → "No member named @x" when case differed
 *
 * The first one mattered most: a public profile is what §22's dimensions, the
 * teaching list, follows, referrals and "who recruited you" all hang off, so a
 * member with a capital in their name had no public presence at all — verified
 * live, `/u/Prem%20Sai` returned 404 while `/u/prajwal` returned 200.
 *
 * Matching is on `username_lower`, a stored generated column with a unique index,
 * so `profiles.username` stays exactly as typed for display while every lookup is
 * case-insensitive. The index being unique also means "Alice" and "alice" are one
 * account rather than two.
 *
 * Do not use `ilike` here. A username may legitimately contain `_` or `%`, both
 * of which are wildcards, so `/u/a_b` would match `aXb` and return the wrong
 * person — or several.
 */

export interface UsernameMatch {
  id: string;
  username: string;
}

/** Trim, lowercase, and look up. Returns null when nobody matches. */
export async function findProfileByUsername(
  supabase: SupabaseClient,
  input: string,
): Promise<UsernameMatch | null> {
  const key = input.trim().toLowerCase();
  if (key.length === 0) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username_lower", key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, username: data.username as string };
}

/**
 * Link to somebody's public profile.
 *
 * Six places built `/u/${username}` by interpolation. Browsers will usually
 * encode a space themselves, but "usually" is doing a lot of work in a URL that
 * has to survive being pasted into a chat app, put in an OG card and read by a
 * crawler — and a handle with non-ASCII characters is exactly the case where
 * the fallback is least predictable.
 *
 * Pairs with `decodePathSegment` in lib/pathSegment.ts: encode on the way out,
 * decode on the way in, and the round trip holds for spaces, percents and
 * everything else.
 */
export function profileHref(username: string): string {
  return `/u/${encodeURIComponent(username.trim())}`;
}
