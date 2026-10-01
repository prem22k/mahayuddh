-- Phase 3 Step 20: weekly recaps + squad wall (Bible §31, §32).
--
-- A recap is a frozen projection of a week, stored so it can be shared after
-- the fact. It is NOT a source of truth: every number in body_json is derived
-- from battles/problem_events/approaches/suggestions at generation time and is
-- labelled with the window it covers.

create table if not exists public.squad_recaps (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  -- Frozen projection. See lib/recap.ts for the shape and its derivation.
  body_json jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  constraint squad_recaps_window_check check (week_end >= week_start)
);

-- One recap per squad per week: regenerating replaces it rather than stacking.
create unique index if not exists squad_recaps_week_unique
  on public.squad_recaps (squad_id, week_start);
create index if not exists squad_recaps_squad_idx
  on public.squad_recaps (squad_id, week_start desc);

alter table public.squad_recaps enable row level security;

-- Recaps are the shareable squad artifact, so public read is the point (§31).
-- It contains no per-user private data: counts, titles and usernames only.
create policy "Squad recaps publicly readable" on public.squad_recaps
  for select using (true);
create policy "Squad members create recaps" on public.squad_recaps
  for insert with check (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id
      and squad_members.user_id = (select auth.uid())
  ));
create policy "Generators update own recaps" on public.squad_recaps
  for update using ((select auth.uid()) = generated_by)
  with check ((select auth.uid()) = generated_by);
create policy "Generators delete own recaps" on public.squad_recaps
  for delete using ((select auth.uid()) = generated_by);

-- ── Squad wall (milestones) ─────────────────────────────────────────────────
-- Appended by trigger on the events that earn them. Capped by view query, not
-- by deletion: history is not pruned (§64).

create table if not exists public.squad_milestones (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade not null,
  kind text check (kind in (
    'first_member', 'first_challenge', 'first_solve', 'milestone_solves',
    'milestone_challenges', 'season_complete', 'goal_complete'
  )) not null,
  title text not null check (char_length(title) between 1 and 120),
  detail text check (detail is null or char_length(detail) <= 300),
  occurred_at timestamp with time zone default now() not null
);

-- One milestone of each kind per squad: a trigger must not fire twice for the
-- same thing, and neither must a re-run or a re-import.
create unique index if not exists squad_milestones_kind_once
  on public.squad_milestones (squad_id, kind);
create index if not exists squad_milestones_squad_idx
  on public.squad_milestones (squad_id, occurred_at desc);

alter table public.squad_milestones enable row level security;

create policy "Squad milestones publicly readable" on public.squad_milestones
  for select using (true);

-- ── Triggers ───────────────────────────────────────────────────────────────
-- Walks up from a `battles` row: solve milestones, plus the squad's first.
create or replace function public.record_solve_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  squad uuid;
  total int;
  target int;
begin
  if new.outcome <> 'solved' or new.squad_id is null then
    return new;
  end if;
  squad := new.squad_id;

  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (squad, 'first_solve', 'First battle won',
          'Somebody in the squad got their first solve logged here.', new.ended_at)
  on conflict (squad_id, kind) do nothing;

  select count(*) into total
  from public.problem_events e
  where e.user_id = new.user_id and e.kind in ('solved', 'revisited');
  if total >= 50 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    values (squad, 'milestone_solves', '50 solves',
            'Somebody here has logged 50 solves in this squad.', new.ended_at)
    on conflict (squad_id, kind) do nothing;
  end if;

  select count(*) into target
  from public.problem_events e
  where e.kind in ('solved', 'revisited')
    and e.user_id in (select user_id from public.squad_members where squad_id = squad);
  if target >= 100 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    values (squad, 'milestone_solves', '100 solves',
            'The squad passed 100 logged solves.', new.ended_at)
    on conflict (squad_id, kind) do update set detail = excluded.detail;
  end if;

  return new;
end $$;

drop trigger if exists record_solve_milestone on public.battles;
create trigger record_solve_milestone
  after update on public.battles
  for each row
  when (old.outcome is distinct from new.outcome and new.outcome = 'solved')
  execute function public.record_solve_milestone();

-- Membership and challenge milestones. `on conflict do nothing` is what makes
-- these first-only, so a re-join does not reset the wall.
create or replace function public.record_first_member_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.squad_milestones (squad_id, kind, title, detail)
  values (new.squad_id, 'first_member', 'Squad formed', 'The first person joined this squad.')
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;

drop trigger if exists record_first_member_milestone on public.squad_members;
create trigger record_first_member_milestone
  after insert on public.squad_members
  for each row execute function public.record_first_member_milestone();

create or replace function public.record_first_challenge_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  squad uuid;
begin
  if new.squad_id is null then
    return new;
  end if;
  squad := new.squad_id;
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (squad, 'first_challenge', 'First challenge sent',
          'Somebody decided a problem was worth handing to a squad mate.',
          new.created_at)
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;

drop trigger if exists record_first_challenge_milestone on public.suggestions;
create trigger record_first_challenge_milestone
  after insert on public.suggestions
  for each row execute function public.record_first_challenge_milestone();

-- Goal completion belongs on the wall: a finished shared goal is the ritual
-- actually paying off.
create or replace function public.record_goal_complete_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'goal_complete', 'Goal reached',
          left(new.title, 120), now())
  on conflict (squad_id, kind) do update
    set detail = excluded.detail, occurred_at = excluded.occurred_at;
  return new;
end $$;

drop trigger if exists record_goal_complete_milestone on public.squad_goals;
create trigger record_goal_complete_milestone
  after update on public.squad_goals
  for each row execute function public.record_goal_complete_milestone();

create or replace function public.record_season_complete_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'complete' or old.status = 'complete' then
    return new;
  end if;
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'season_complete', 'Season complete', left(new.name, 120), now())
  on conflict (squad_id, kind) do update
    set detail = excluded.detail, occurred_at = excluded.occurred_at;
  return new;
end $$;

drop trigger if exists record_season_complete_milestone on public.squad_seasons;
create trigger record_season_complete_milestone
  after update on public.squad_seasons
  for each row execute function public.record_season_complete_milestone();