/**
 * Quiet hours — single source of truth.
 *
 * Default: 22:00–08:00 in the user's local day, which for the current user
 * base is Asia/Kolkata (IST, UTC+5:30). IST has no DST, so a fixed offset is
 * exact. Server call sites use this module; nothing computes quiet hours from
 * viewer-local getHours().
 *
 * The DB `in_quiet_hours()` function still uses UTC 22–08 until a migration
 * lands. Trigger-based notices continue to follow that database function.
 */

export const QUIET_TZ = "Asia/Kolkata";
export const QUIET_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 8;

/** Hour of day (0–23) in IST for an instant. */
export function istHourOfDay(at: Date | number = new Date()): number {
  const ms = at instanceof Date ? at.getTime() : at;
  return new Date(ms + QUIET_TZ_OFFSET_MS).getUTCHours();
}

/** True when `at` falls in 22:00–08:00 IST. */
export function inQuietHoursIST(at: Date | number = new Date()): boolean {
  const hour = istHourOfDay(at);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}
