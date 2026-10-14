-- Make battle-derived history reliable (follow-up to the core-loop audit).
--
-- Until now, problem_events for a battle end was written by the CLIENT, in
-- NowSolvingBar, fire-and-forget with `.catch(()=>{})`:
--
--     endBattle(battleId, "solved", …).catch(() => {});
--     logProblemEvent({ …, battleId }).catch(() => {});
--
-- Two independent writes, the second best-effort. A dropped insert, a closed tab
-- between the two calls, or an offline moment — and the solve exists in `battles`
-- but never in `problem_events`. That row is what timelines, journeys, recaps,
-- the retention gate (§58), the recommendation engine (§24) and the feed all
-- read. A missing one is not a missing badge; it is a solve the product pretends
-- never happened, in exactly the places a member goes to look at what they did.
--
-- The fix follows the rule this codebase already uses for counters: what must be
-- true is maintained by a trigger, so readers cannot drift from it.
--
--   - `append_problem_event_on_battle_end` fires on the battles outcome change,
--     for solved and failed only. Abandoned is not history worth keeping, which
--     is also why the client never logged it.
--   - solved vs revisited uses the same rule as the client (`wasSolved`): a user
--     who already has a solved event for the slug gets 'revisited'.
--   - Exactly-once is structural, not hoped for. A partial unique index on
--     (battle_id, kind) makes a second writer impossible, and the trigger checks
--     NOT EXISTS first so the normal path never hits the constraint.
--
-- Manual toggles (sheets/matrix checkboxes) are untouched: they have no battle
-- row, carry battle_id NULL, and the partial index does not apply to them.

-- One event per battle end. The index is the arbiter; the trigger's NOT EXISTS
-- is the fast path that avoids ever touching it.
create unique index if not exists problem_events_battle_once
  on public.problem_events (battle_id, kind)
  where battle_id is not null;

create or replace function public.append_problem_event_on_battle_end()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text;
begin
  -- Only the two outcomes the client ever logged.
  if new.outcome = 'solved' then
    -- Same rule as the dock's wasSolved: a repeat solve is a revisit.
    if exists (
      select 1 from public.problem_events e
      where e.user_id = new.user_id
        and e.problem_slug = new.problem_slug
        and e.kind = 'solved'
    ) then
      v_kind := 'revisited';
    else
      v_kind := 'solved';
    end if;
  elsif new.outcome = 'failed' then
    v_kind := 'failed';
  else
    return new;
  end if;

  insert into public.problem_events (user_id, problem_slug, kind, battle_id, duration_sec, metadata)
  select
    new.user_id,
    new.problem_slug,
    v_kind,
    new.id,
    new.duration_sec,
    jsonb_build_object('source', coalesce(new.evidence, 'none'))
  where not exists (
    select 1 from public.problem_events e
    where e.battle_id = new.id and e.kind = v_kind
  );

  return new;
end;
$$;

drop trigger if exists append_problem_event_on_battle_end on public.battles;
create trigger append_problem_event_on_battle_end
  after update of outcome on public.battles
  for each row
  when (old.outcome is distinct from new.outcome
        and new.outcome in ('solved', 'failed'))
  execute function public.append_problem_event_on_battle_end();

comment on function public.append_problem_event_on_battle_end() is
  'Battle ends are the one place history must not depend on a best-effort client write. Exactly-once via problem_events_battle_once; manual toggles (battle_id NULL) are unaffected.';
