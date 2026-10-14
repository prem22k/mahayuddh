-- Two fixes to the Step 20 wall triggers.
--
-- 1. record_solve_milestone used new.ended_at for occurred_at. ended_at is
--    nullable and the solve path can set outcome without it, so the insert
--    raised a not-null violation — which made EVERY battle solve fail.
--    coalesce to now().
--
-- 2. record_first_challenge_milestone picked one squad with ORDER BY joined_at
--    LIMIT 1. Two people can share several squads, and "the earliest one" is
--    arbitrary. Every squad that contains both parties owns this challenge, so
--    record it for each.
--
-- Also drops the diagnostic function created under 20261003000008.

drop function if exists public.debug_challenge_squad(uuid, uuid);

create or replace function public.record_solve_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  squad uuid;
  at_time timestamptz;
  total int;
  squad_total int;
begin
  if new.outcome <> 'solved' or new.squad_id is null then
    return new;
  end if;

  squad := new.squad_id;
  -- ended_at is nullable; occurred_at is not.
  at_time := coalesce(new.ended_at, now());

  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (squad, 'first_solve', 'First battle won',
          'Somebody in the squad got their first solve logged here.', at_time)
  on conflict (squad_id, kind) do nothing;

  select count(*) into total
  from public.problem_events e
  where e.user_id = new.user_id and e.kind in ('solved', 'revisited');
  if total >= 50 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    values (squad, 'milestone_solves', '50 solves',
            'Somebody here has logged 50 solves in this squad.', at_time)
    on conflict (squad_id, kind) do nothing;
  end if;

  -- 100 is a squad-wide milestone, so it needs its own kind: the unique index
  -- is one row per (squad, kind) and 50 was occupying 'milestone_solves'.
  select count(*) into squad_total
  from public.problem_events e
  where e.kind in ('solved', 'revisited')
    and e.user_id in (select user_id from public.squad_members where squad_id = squad);
  if squad_total >= 100 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    values (squad, 'milestone_solves_100', '100 solves',
            'The squad passed 100 logged solves.', at_time)
    on conflict (squad_id, kind) do nothing;
  end if;

  return new;
end $$;

create or replace function public.record_first_challenge_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Every squad containing both parties owns this challenge. A challenge to
  -- somebody outside any squad is not a squad wall event.
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  select sm.squad_id, 'first_challenge', 'First challenge sent',
         'Somebody decided a problem was worth handing to a squad mate.',
         coalesce(new.created_at, now())
  from public.squad_members sm
  where sm.user_id = new.from_user
    and exists (
      select 1 from public.squad_members other
      where other.squad_id = sm.squad_id and other.user_id = new.to_user
    )
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;

-- 'milestone_solves' was used for both 50 and 100 in the original version, and
-- the unique index is per (squad, kind), so the second could never land.
alter table public.squad_milestones drop constraint if exists squad_milestones_kind_check;
alter table public.squad_milestones
  add constraint squad_milestones_kind_check
  check (kind in (
    'first_member', 'first_challenge', 'first_solve', 'milestone_solves',
    'milestone_solves_100', 'milestone_challenges', 'season_complete', 'goal_complete'
  ));
