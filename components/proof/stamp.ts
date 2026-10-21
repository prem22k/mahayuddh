/**
 * Date stamps for shared artifacts (proof pass, public profile).
 *
 * Always UTC and always labelled as such where a time is shown: these pages
 * are server-rendered for strangers in any timezone, and a bare "21:14" would
 * silently mean whatever zone the server happens to run in. Months are spelled
 * out by hand because ICU renders en-GB September as "Sept" on some runtimes.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "08 OCT 2026" (UTC), or null for a missing/invalid instant. */
export function stampDate(iso: string | null | undefined): string | null {
  const d = parse(iso);
  if (!d) return null;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()}`;
}

/** "20:15" (UTC, 24h), or null. Callers append "UTC". */
export function stampTime(iso: string | null | undefined): string | null {
  const d = parse(iso);
  if (!d) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "Oct 2026" (UTC), or null. */
export function monthYear(iso: string | null | undefined): string | null {
  const d = parse(iso);
  if (!d) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "8m 34s" / "42s" for a positive gap in seconds. */
export function gapLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
