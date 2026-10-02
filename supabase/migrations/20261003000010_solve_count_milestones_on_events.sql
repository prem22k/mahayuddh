-- Move the solve-count wall milestones off `battles` and onto `problem_events`.
--
-- Why. The 50/100 milestones counted rows in public.problem_events, but they
-- fired from a trigger on public.battles. Those two rows are written by the app
-- as two independent, unordered, fire-and-forget requests
-- (NowSolvingBar.handleComplete calls endBattle(...) and then
-- logProblemEvent(...), neither awaited). So the count the trigger saw depended
-- on which request landed first, and there was no second chance: nothing
-- re-fires when the event row arrives late.
--
-- Measured against the live database before this migration: with 49 solve
-- events present, firing the battle update, then writing the 50th event left
-- the user on 50 logged solves and the wall permanently silent. Same for 100.
--
-- Moving the trigger to the insert that defines the count removes the race
-- entirely — the count is exact inside the same transaction as the insert.
-- It also covers solves that never had a battle session at all, which a
-- battles-only trigger could never reward: a solve logged from the roadmap
-- matrix or a sheet batch produces no `battles` row, so before this change
-- those solves could push somebody past 50 without the wall ever noticing.
--
-- `first_solve` deliberately stays on `battles`. It is a statement about a
-- battle ("first battle won"), not about a count, and it is verified working
-- there.

drop trigger if exists record_solve_count_milestone on public.problem_events;

create or replace function public.record_solve_count_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  total int;
begin
  if new.kind not in ('solved', 'revisited') then
    return new;
  end if;

  select count(*) into total
  from public.problem_events e
  where e.user_id = new.user_id
    and e.kind in ('solved', 'revisited');

  -- Every squad the person belongs to owns the count, the same way a challenge
  -- belongs to every squad containing both parties. Picking one would be
  -- arbitrary when somebody is in three squads.
  if total >= 50 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    select sm.squad_id, 'milestone_solves', '50 solves',
           'Somebody here has logged 50 solves in this squad.',
           coalesce(new.created_at, now())
    from public.squad_members sm
    where sm.user_id = new.user_id
    on conflict (squad_id, kind) do nothing;
  end if;

  if total >= 100 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    select sm.squad_id, 'milestone_solves_100', '100 solves',
           'The squad passed 100 logged solves.',
           coalesce(new.created_at, now())
    from public.squad_members sm
    where sm.user_id = new.user_id
    on conflict (squad_id, kind) do nothing;
  end if;

  return new;
end $$;

create trigger record_solve_count_milestone
  after insert on public.problem_events
  for each row
  when (new.kind in ('solved', 'revisited'))
  execute function public.record_solve_count_milestone();

-- Drop the two count inserts from the battles trigger, leaving only first_solve.
-- Keeping them would double-count against the new trigger and, worse, would
-- re-introduce the same race on a second code path.
create or replace function public.record_solve_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.outcome <> 'solved' or new.squad_id is null then
    return new;
  end if;

  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'first_solve', 'First battle won',
          'Somebody in the squad got their first solve logged here.',
          coalesce(new.ended_at, now()))
  on conflict (squad_id, kind) do nothing;

  return new;
end $$;