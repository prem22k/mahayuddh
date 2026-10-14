-- Phase 1 Steps 7+8: battle sessions + problem history (Bible §4.1, §44, §48).
-- battles = Attempt/During object (private). problem_events = append-only timeline.
-- user_problem_status stays the CURRENT state; history lives in problem_events.

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  squad_id uuid references public.squads(id) on delete set null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  duration_sec int check (duration_sec is null or duration_sec >= 0),
  outcome text check (outcome in ('in_progress', 'solved', 'failed', 'abandoned')) default 'in_progress' not null,
  self_reported boolean default true not null,
  evidence text check (evidence in ('leetcode', 'none')) default 'none' not null,
  scratchpad_md text check (scratchpad_md is null or octet_length(scratchpad_md) <= 20000),
  confidence int check (confidence is null or (confidence between 1 and 5)),
  created_at timestamp with time zone default now()
);
create index if not exists battles_user_slug_idx on public.battles (user_id, problem_slug, started_at desc);
-- One live session per user: honesty guard (no double timers claiming one solve).
create unique index if not exists battles_one_live_per_user on public.battles (user_id) where outcome = 'in_progress';

create table if not exists public.problem_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  kind text check (kind in ('attempted', 'solved', 'explained', 'revisited', 'challenge_completed', 'failed', 'stuck')) not null,
  battle_id uuid references public.battles(id) on delete set null,
  duration_sec int check (duration_sec is null or duration_sec >= 0),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);
create index if not exists problem_events_user_slug_idx on public.problem_events (user_id, problem_slug, created_at desc);
create index if not exists problem_events_slug_idx on public.problem_events (problem_slug, created_at desc);

alter table public.battles enable row level security;
alter table public.problem_events enable row level security;

-- Battles are PRIVATE by default (Bible Principle 6). Own-row only.
create policy "Users manage own battles" on public.battles
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Events: append-only. Client INSERT own + public read (timelines, squad activity).
-- No UPDATE/DELETE policies: history is never rewritten.
create policy "Users can append own problem events" on public.problem_events
  for insert with check ((select auth.uid()) = user_id);
create policy "Problem events publicly readable" on public.problem_events
  for select using (true);

-- Backfill: current status rows become first history entries (source: self-reported,
-- honest: we cannot know pre-history provenance).
insert into public.problem_events (user_id, problem_slug, kind, created_at)
select user_id, problem_slug,
  case when status = 'solved' then 'solved' else 'attempted' end,
  coalesce(solved_at, now())
from public.user_problem_status
on conflict do nothing;
