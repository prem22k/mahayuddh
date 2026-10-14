/**
 * Shared pure formatting helpers.
 *
 * A LEAF module by design: no imports at all. That lets `lib/battleCard.ts`,
 * `lib/revenge.ts`, `lib/dailyBattle.ts` and `tests/smoke.test.mjs` all use the
 * same implementation without any of them needing a bundler path alias, which
 * is what keeps the pure logic directly loadable by `node --test`.
 *
 * Explicit `.ts` extensions are used on relative imports because Node's ESM
 * resolver requires them; tsconfig sets `allowImportingTsExtensions` to match.
 */

/** `1497` -> `"24:57"`. Null when there is no real duration to show. */
export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return null;
  const s = Math.trunc(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Fallback display title when a slug is the only identifier we have. */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Whole days between two instants, never negative. */
export function daysBetween(from: Date | string | number, to: Date = new Date()): number {
  const a =
    typeof from === "number" ? from : typeof from === "string" ? Date.parse(from) : from.getTime();
  if (Number.isNaN(a)) return 0;
  return Math.max(0, Math.floor((to.getTime() - a) / 86_400_000));
}

/** Relative day label: today / 1 day ago / N days ago. */
export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}