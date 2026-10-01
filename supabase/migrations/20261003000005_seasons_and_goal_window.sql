-- Phase 3 Step 19: squad seasons + goal progress.
--
-- Seasons are an intent container for a squad over a bounded window (§30). No
-- shop, no XP, no unlocks: metrics are plain counts over existing events.

create table if not exists public.squad_seasons (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade not null,
  name text not null check (char_length(name) between 1 and 80),
  objective text check (objective is null or char_length(objective) <= 500),
  starts_at date not null default current_date,
  ends_at date,
  status text check (status in ('upcoming', 'active', 'complete')) default 'active' not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  -- One live season at a time; history is kept.
  constraint squad_seasons_window_check check (ends_at is null or ends_at >= starts_at)
);

create unique index if not exists squad_seasons_one_active
  on public.squad_seasons (squad_id) where status = 'active';
create index if not exists squad_seasons_squad_idx
  on public.squad_seasons (squad_id, starts_at desc);

alter table public.squad_seasons enable row level security;

create policy "Squad seasons publicly readable" on public.squad_seasons
  for select using (true);
create policy "Squad members create seasons" on public.squad_seasons
  for insert with check (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id
      and squad_members.user_id = (select auth.uid())
  ));
create policy "Squad members update seasons" on public.squad_seasons
  for update using (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id
      and squad_members.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id
      and squad_members.user_id = (select auth.uid())
  ));
create policy "Squad members delete seasons" on public.squad_seasons
  for delete using (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id
      and squad_members.user_id = (select auth.uid())
  ));

-- Goals can be scoped to a window, and can be archived. "One active goal at a
-- time" was a v0 simplification; Step 19 asks for multiple goals per squad.
alter table public.squad_goals add column if not exists starts_at date default current_date;
alter table public.squad_goals add column if not exists archived boolean default false not null;

create index if not exists squad_goals_active_idx
  on public.squad_goals (squad_id, created_at desc)
  where status = 'active' and archived = false;