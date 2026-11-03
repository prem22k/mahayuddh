/**
 * Cache keys, scoped to the signed-in user.
 *
 * Every entry the client cache holds is keyed `[ownerId, ...callerKey]`, where
 * ownerId is the signed-in user's id (or "anon"). Two consequences callers get
 * for free:
 *
 * - Data fetched as one user is unreachable as another. Even if a sign-out
 *   races a fetch, the next user's keys never match the previous user's
 *   entries, so the cache cannot hand one person another person's rows.
 * - Invalidating "squad-members" only touches the current user's entries.
 *
 * Pure functions so the scoping rules are testable without React.
 */

export type QueryKeyPart = string | number | boolean | null;
/** What a caller passes: a name first, then whatever the data depends on. */
export type QueryKey = readonly [name: string, ...parts: QueryKeyPart[]];

export const ANON_OWNER = "anon";

export function ownerOf(userId: string | null): string {
  return userId ?? ANON_OWNER;
}

/** The key the cache actually stores. Null means "do not fetch". */
export function scopedKey(userId: string | null, key: QueryKey | null): readonly QueryKeyPart[] | null {
  if (key === null) return null;
  return [ownerOf(userId), ...key];
}

/** True when a stored key belongs to this user and has one of these names. */
export function matchesNames(stored: unknown, userId: string | null, names: readonly string[]): boolean {
  return (
    Array.isArray(stored) &&
    stored[0] === ownerOf(userId) &&
    typeof stored[1] === "string" &&
    names.includes(stored[1])
  );
}

/** True when a stored key belongs to this user, whatever its name. */
export function ownedBy(stored: unknown, userId: string | null): boolean {
  return Array.isArray(stored) && stored[0] === ownerOf(userId);
}

/**
 * The prefix SWR's serializer gives every key owned by this user. SWR
 * serializes an array key as `@` + each element JSON-encoded + `,`, so a
 * user's keys all start with `@"<owner>",`.
 */
export function serializedOwnerPrefix(userId: string | null): string {
  return `@${JSON.stringify(ownerOf(userId))},`;
}
