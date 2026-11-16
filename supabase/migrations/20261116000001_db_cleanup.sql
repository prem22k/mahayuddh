-- Database audit, safe part (2026-11-16).
--
-- Nothing the app or the database still uses is removed here, so this can be
-- pushed before or after the code that ships with it.
--
-- 1. Indexes that are a leading prefix of another index on the same table.
--    The longer index already serves every lookup the short one did; the
--    short one only cost a write on every insert and update.
drop index if exists public.ai_calls_user_id_idx;              -- ai_calls_user_created_idx (user_id, created_at)
drop index if exists public.contests_upcoming_idx;             -- contests_starts_at_platform_key (starts_at, platform)
drop index if exists public.daily_battles_user_id_idx;         -- daily_battles_pkey (user_id, battle_date)
drop index if exists public.follows_follower_id_idx;           -- follows_pkey
drop index if exists public.list_problems_list_id_idx;         -- list_problems_list_slug_unique
drop index if exists public.note_shares_note_id_idx;           -- note_shares_note_id_shared_with_key
drop index if exists public.squad_members_squad_idx;           -- squad_members_pkey (squad_id, user_id)
drop index if exists public.squad_referrals_squad_idx;         -- squad_referrals_squad_id_referrer_id_key
drop index if exists public.user_blocks_blocker_id_idx;        -- user_blocks_pkey
drop index if exists public.user_problem_status_user_id_idx;   -- user_problem_status_user_id_problem_slug_key
drop index if exists public.leaderboard_snapshots_lookup_idx;  -- leaderboard_snapshots_once_per_day (scope, metric, snapshot_date, user_id)
drop index if exists public.squad_recaps_squad_idx;            -- squad_recaps_week_unique (squad_id, week_start)
-- Same predicate (status = 'pending') as suggestions_pending_unique (to_user, problem_slug);
-- status is constant inside that predicate, so (to_user, status) adds nothing either.
drop index if exists public.suggestions_to_user_pending_idx;
drop index if exists public.suggestions_to_pending_idx;

-- 2. The one foreign key with no index: deleting a profile scanned all of
--    leaderboard_snapshots to cascade.
create index if not exists leaderboard_snapshots_user_idx
  on public.leaderboard_snapshots (user_id);

-- 2b. Reads the audit found with no supporting index (each was a Seq Scan
--     with enable_seqscan off):
--     - forks of a note: refresh_fork_counts_for_note counts by fork_of on
--       every note insert, update and delete; lib/data/notebook.ts filters on it
create index if not exists notebook_notes_fork_of_idx
  on public.notebook_notes (fork_of) where fork_of is not null;
--     - notification history, read and unread (lib/data/notifications.ts); the
--       existing index only covers unread rows
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
--     - challenges by recipient or sender, newest first, any status
--       (lib/data/challenges.ts, lib/data/suggestions.ts)
create index if not exists suggestions_to_user_created_idx
  on public.suggestions (to_user, created_at desc);
create index if not exists suggestions_from_user_created_idx
  on public.suggestions (from_user, created_at desc);
drop index if exists public.suggestions_from_user_idx;         -- prefix of the index above

-- 3. Functions nothing calls: no app code, trigger, policy, view or other
--    function. No CASCADE, so this fails loudly if that ever stops being true.
--    - default_leaderboard_segment: the page always passed a segment.
--    - generate_squad_code: invite codes are made by the app.
--    - stuck_reminder_allowed / suggestion_remind_allowed: the throttles live
--      in the UPDATE's WHERE clause instead (race-safe).
drop function if exists public.default_leaderboard_segment(uuid);
drop function if exists public.generate_squad_code();
drop function if exists public.stuck_reminder_allowed(uuid, uuid);
drop function if exists public.suggestion_remind_allowed(uuid, uuid);
