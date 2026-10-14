/**
 * Squad-local calendar days.
 *
 * Squad-local == Asia/Kolkata (IST, UTC+5:30) by default, until per-squad
 * timezone lands. Every day bucket here derives from UTC timestamps shifted
 * into IST — never the viewer's local timezone — so two members in different
 * zones agree on what "today" means.
 *
 * IST has no DST, so a fixed +5:30 offset is exact.
 */

export const SQUAD_TZ = "Asia/Kolkata";
export const SQUAD_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Integer IST day number: floor((ms + offset) / day). Monotonic, tz-safe. */
export function squadDayNumFromMs(ms: number): number {
  return Math.floor((ms + SQUAD_TZ_OFFSET_MS) / DAY_MS);
}

/** YYYY-MM-DD key for an IST day number. */
export function squadDayKeyFromDayNum(dayNum: number): string {
  const d = new Date(dayNum * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM-DD key for any instant, bucketed in IST. */
export function squadDayKeyFromMs(ms: number): string {
  return squadDayKeyFromDayNum(squadDayNumFromMs(ms));
}

/** YYYY-MM-DD key for an ISO timestamp, bucketed in IST. */
export function squadDayKeyFromISO(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return squadDayKeyFromMs(ms);
}

/** Today's IST day number. */
export function squadTodayDayNum(nowMs: number = Date.now()): number {
  return squadDayNumFromMs(nowMs);
}

/** Today's IST YYYY-MM-DD key. */
export function squadTodayKey(nowMs: number = Date.now()): string {
  return squadDayKeyFromDayNum(squadTodayDayNum(nowMs));
}

/** UTC ISO of IST midnight for a day number (use as gte floor for queries). */
export function squadMidnightUtcISOFromDayNum(dayNum: number): string {
  return new Date(dayNum * DAY_MS - SQUAD_TZ_OFFSET_MS).toISOString();
}

/** UTC ISO of today's IST midnight (use as "since today" floor). */
export function squadStartOfTodayUtcISO(nowMs: number = Date.now()): string {
  return squadMidnightUtcISOFromDayNum(squadTodayDayNum(nowMs));
}

/** Last `days` IST day numbers, oldest -> newest. */
export function squadWeekDayNums(days = 7, nowMs: number = Date.now()): number[] {
  const today = squadTodayDayNum(nowMs);
  return Array.from({ length: days }, (_, i) => today - (days - 1) + i);
}

/** Short weekday label for an IST day number (e.g. "Mon"). */
export function squadDayLabel(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}
