-- Leaderboard contest metrics: persist contest participation already fetched from LeetCode.
alter table public.profiles
  add column if not exists contest_attended int default 0,
  add column if not exists contest_global_rank int,
  add column if not exists contest_top_percentage float;
