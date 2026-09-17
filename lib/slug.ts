// Single source of truth for LeetCode problem-slug handling.
// Mirrors the DB check constraints (suggestions_slug_format et al.).
export const MAX_SLUG_LEN = 80;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_RE.test(value);
}

/** "Word Ladder II" -> "word-ladder-ii" (capped, no edge dashes). */
export function slugifyTitle(title: string, maxLen = MAX_SLUG_LEN): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxLen);
}

/** Trim + lowercase + validate; null when unusable. */
export function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

/** Dedupe + validate + cap a mixed slug list (form input, API payloads). */
export function normalizeSlugList(input: unknown, max = 2000): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const item of input) {
    const slug = normalizeSlug(typeof item === "string" ? item : String(item));
    if (slug) {
      out.add(slug);
      if (out.size >= max) break;
    }
  }
  return [...out];
}
