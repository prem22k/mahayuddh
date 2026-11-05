/**
 * Every profiles column the app selects, in one place.
 *
 * The browser data layer, /api/auth/profile and /api/health all read these
 * lists. A column added here must exist in production before the code ships:
 * on 2026-11-05 a deploy selected profiles.leetcode_verified_at before its
 * migration ran, and every signed-in page failed. /api/health now selects
 * both lists (zero rows) so the 5-minute probe reports that as
 * `schema: "mismatch"` instead of staying green.
 */

/** Columns anyone may read (anon and authenticated hold SELECT on each). */
export const PUBLIC_PROFILE_COLUMNS =
  "id,username,leetcode_username,leetcode_verified_at,avatar_url,active_squad_id,contest_rating,global_rank,streak,total_easy,total_medium,total_hard,contest_attended,contest_global_rank,contest_top_percentage,last_synced_at,created_at";

/**
 * The signed-in user's own profile: the public columns plus first-run state.
 * Never use this for other people's profiles: anonymous visitors have no
 * SELECT grant on the first-run columns, so the query would fail for them.
 */
export const OWN_PROFILE_COLUMNS = `${PUBLIC_PROFILE_COLUMNS},onboarded_at,tour_completed_at`;
