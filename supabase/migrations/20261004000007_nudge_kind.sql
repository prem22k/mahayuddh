-- Wave D growth: a seventh notification kind for nudges.
--
-- Current CHECK (from 20261003000000_phase0_2_gap_repair.sql, confirmed in
-- schema.sql as notifications_kind_check): kind in ('challenge',
-- 'challenge_completed', 'goal', 'revenge', 'recap', 'contest').
--
-- 'nudge' covers the streak-nudges cron's three subtypes — streak-at-risk,
-- squad-solved-without-you, and the 3/7/14-day lapsed digest. One kind keeps
-- the CHECK small; the dedupe_key names the subtype and the date
-- (nudge:streak-risk:2026-10-14), so the partial unique index on
-- (user_id, kind, dedupe_key) still collapses repeats to one open notice.

alter table public.notifications drop constraint if exists notifications_kind_check;

alter table public.notifications add constraint notifications_kind_check
  check (kind in ('challenge', 'challenge_completed', 'goal', 'revenge', 'recap', 'contest', 'nudge'));

select pg_notify('pgrst', 'reload schema');
