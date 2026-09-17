-- Per-user sync throttle: blocks LeetCode hammering and write churn.
create table if not exists public.sync_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_sync_at timestamp with time zone not null default now()
);

alter table public.sync_rate_limits enable row level security;

-- No client access; service role only.
drop policy if exists "No client access to sync rate limits" on public.sync_rate_limits;
create policy "No client access to sync rate limits"
  on public.sync_rate_limits for all
  using (false)
  with check (false);

create index if not exists sync_rate_limits_last_sync_idx
  on public.sync_rate_limits (last_sync_at);
