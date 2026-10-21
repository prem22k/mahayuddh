/**
 * Display helpers for frozen recaps and season summaries.
 *
 * Pure formatting of values the artifact already stores: dates are parsed as
 * calendar days (no timezone shift), and nothing here derives a new number
 * from the underlying rows.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** `2026-10-08` -> `8 Oct 2026` (or `8 Oct` without the year). */
export function formatDay(iso: string, opts: { year?: boolean; long?: boolean } = {}): string {
  const p = dayParts(iso);
  if (!p) return iso;
  const month = (opts.long ? MONTHS_LONG : MONTHS_SHORT)[p.m];
  return `${p.d} ${month}${opts.year ? ` ${p.y}` : ""}`;
}

/**
 * A week or season window: `5–11 Oct`, `28 Sep – 4 Oct`, `14 Sep – 11 Oct 2026`.
 * The year goes on the end only when asked for, or when the window crosses one.
 */
export function formatRange(
  startIso: string,
  endIso: string | null | undefined,
  opts: { year?: boolean; long?: boolean } = {}
): string {
  const a = dayParts(startIso);
  if (!a) return startIso;
  const b = endIso ? dayParts(endIso) : null;
  if (!b) return `from ${formatDay(startIso, { year: true, long: opts.long })}`;
  const months = opts.long ? MONTHS_LONG : MONTHS_SHORT;
  if (a.y !== b.y) {
    return `${formatDay(startIso, { year: true, long: opts.long })} – ${formatDay(endIso as string, { year: true, long: opts.long })}`;
  }
  const tail = opts.year ? ` ${b.y}` : "";
  if (a.m === b.m) return `${a.d}–${b.d} ${months[b.m]}${tail}`;
  return `${a.d} ${months[a.m]} – ${b.d} ${months[b.m]}${tail}`;
}

/** ISO-8601 week number of a calendar day (weeks start Monday). */
export function isoWeek(iso: string): { week: number; year: number } | null {
  const p = dayParts(iso);
  if (!p) return null;
  const date = new Date(Date.UTC(p.y, p.m, p.d));
  const dow = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dow + 3); // Thursday of this week
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { week, year };
}

/** Whole calendar days from `startIso` to `endIso`, inclusive of both. */
export function daysInclusive(startIso: string, endIso: string): number | null {
  const a = dayParts(startIso);
  const b = dayParts(endIso);
  if (!a || !b) return null;
  const diff = (Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000;
  return diff < 0 ? null : diff + 1;
}

/** A stored speed-up as words: `1420 -> 640` -> `13m faster`, `8m 34s faster`. */
export function formatSpeedup(fromSec: number, toSec: number): string | null {
  const gain = Math.trunc(fromSec - toSec);
  if (!Number.isFinite(gain) || gain <= 0) return null;
  const m = Math.floor(gain / 60);
  const s = gain % 60;
  const words = m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`;
  return `${words} faster`;
}

/** Short serial for an artifact id, in the same shape as challenge tickets. */
export function serialOf(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
