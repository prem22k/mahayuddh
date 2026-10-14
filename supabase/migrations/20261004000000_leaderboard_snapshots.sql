-- Leaderboard rank snapshots: the board's memory (Bible honest-data rule).
--
-- There is no rank-history source in the schema: profiles holds lifetime
-- totals and problem_events holds the raw solves, but neither records what
-- rank somebody held on a given day. So the board freezes one snapshot per
-- (scope, metric, day): the full ordered rows for that view, written once.
-- Change indicators (up/down/same) compare the live order against the latest
-- snapshot strictly before today. A day with no snapshot means the indicator
-- honestly renders "—", never a fabricated delta.
--
-- Writes go through POST /api/leaderboard/snapshot with the service key,
-- which is why there is deliberately NO client insert policy below: anon and
-- authenticated callers can read, only the service role can write.

create table if not exists public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (char_length(scope) between 1 and 64),
  metric text not null check (char_length(metric) between 1 and 64),
  user_id uuid references public.profiles(id) on delete cascade not null,
  rank int not null check (rank >= 1),
  value int not null,
  snapshot_date date not null default current_date,
  constraint leaderboard_snapshots_scope_metric_check
    check (scope <> '' and metric <> '')
);

-- One row per user per view per day: re-sends replace nothing, they collide
-- and lose, which is what makes the first write of the day the frozen one.
create unique index if not exists leaderboard_snapshots_once_per_day
  on public.leaderboard_snapshots (scope, metric, snapshot_date, user_id);
create index if not exists leaderboard_snapshots_lookup_idx
  on public.leaderboard_snapshots (scope, metric, snapshot_date desc);

alter table public.leaderboard_snapshots enable row level security;

-- Snapshots are derived standings (ranks + counts), so public read is the
-- point: anyone viewing the board can see how it moved.
create policy "Leaderboard snapshots publicly readable" on public.leaderboard_snapshots
  for select using (true);
