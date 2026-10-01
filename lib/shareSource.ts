/**
 * Share attribution store (Bible §56, Loop B).
 *
 * Remembers which shared artifact sent this browser so the signup that follows
 * can be credited to it. Kept separate from lib/analytics.ts, which is
 * "use client" and imports through the `@/` alias — that combination cannot be
 * loaded by the plain node test runner, and the expiry rules here are exactly
 * the part that could quietly over-claim a signup.
 *
 * Design constraints:
 *   - Storage is injected, so the rules are testable without a browser.
 *   - A slug is a type plus an id. Nothing else is ever stored, so a link
 *     cannot smuggle a referrer or a full URL into the attribution stream.
 *   - Consuming is one-shot: one visit can be credited to one signup, and a
 *     re-render cannot double-count.
 *   - The record expires. A share link clicked in September must not claim the
 *     signup that happens in December.
 */

export interface SourceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SOURCE_KEY = "mahayuddh_via";
export const SOURCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** type:id, lowercase type, id limited to characters a real artifact id uses. */
const SLUG = /^[a-z]+:[A-Za-z0-9_-]{1,60}$/;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG.test(slug);
}

interface Stored {
  slug: string;
  at: number;
}

function browserStore(): SourceStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // Private mode throws on access rather than returning null.
    return null;
  }
}

function read(store: SourceStore | null): Stored | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SOURCE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { slug, at } = parsed as Partial<Stored>;
    if (!isValidSlug(slug)) return null;
    if (typeof at !== "number" || !Number.isFinite(at)) return null;
    return { slug, at };
  } catch {
    return null;
  }
}

function expired(stored: Stored, now: number): boolean {
  // A future timestamp is treated as expired rather than trusted; a skewed
  // clock should not buy an attribution an extra month.
  return now - stored.at > SOURCE_TTL_MS || stored.at - now > SOURCE_TTL_MS;
}

/** Store the artifact slug for this browser. Invalid slugs are ignored. */
export function rememberSource(
  slug: string,
  opts: { now?: number; store?: SourceStore | null } = {}
): void {
  if (!isValidSlug(slug)) return;
  const store = opts.store === undefined ? browserStore() : opts.store;
  if (!store) return;
  try {
    store.setItem(SOURCE_KEY, JSON.stringify({ slug, at: opts.now ?? Date.now() }));
  } catch {
    // Quota or private mode: attribution is best-effort by contract.
  }
}

/** Read the slug without consuming it. Null when absent, invalid or expired. */
export function peekSource(opts: { now?: number; store?: SourceStore | null } = {}): string | null {
  const store = opts.store === undefined ? browserStore() : opts.store;
  const stored = read(store);
  if (!stored) return null;
  return expired(stored, opts.now ?? Date.now()) ? null : stored.slug;
}

/** Read and clear the slug. One visit is credited to one signup. */
export function consumeSource(opts: { now?: number; store?: SourceStore | null } = {}): string | null {
  const store = opts.store === undefined ? browserStore() : opts.store;
  const stored = read(store);
  if (store) {
    try {
      store.removeItem(SOURCE_KEY);
    } catch {
      // If removal fails, the value is returned anyway — losing one credit is
      // better than blocking the signup.
    }
  }
  if (!stored) return null;
  return expired(stored, opts.now ?? Date.now()) ? null : stored.slug;
}
