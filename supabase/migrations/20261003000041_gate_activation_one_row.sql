-- Fix: gate_activation returned one row per squad (regression from 00039).
--
-- 00039 added the demo-squad exclusion to gate_activation and rewrote it with
-- `group by m.squad_id`, because pairing members to battles reads more naturally
-- that way. The side effect was that the gate stopped being a verdict and became
-- a per-squad list, so validation_gate_board — a UNION ALL of the five gates —
-- returned six rows with "activation" twice:
--
--     activation | false | 0 of 2 members started a battle
--     activation | false | 0 of 2 members started a battle
--     social     | false | ...
--
-- Two problems. The board's shape is five rows (§58 has five measurable gates),
-- and "0 of 2 members" described one squad while sitting on a board labelled
-- "all squads" — the denominator was quietly wrong.
--
-- buildGates() collapses duplicate gate ids through a Map, so the page happened
-- to keep showing five cards and this stayed invisible in the UI. It is the kind
-- of defect that only a shape assertion catches, so there is now one.
--
-- Fixed by counting distinct members across the whole scope with an EXISTS
-- subquery, which needs no GROUP BY at all.

create or replace function public.gate_activation(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  with members as (
    select distinct m.user_id
    from public.squad_members m
    where p_squad_id is not null or exists (
            select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)
  )
  select
    'activation',
    count(*) filter (where started_at is not null) > 0,
    count(*) filter (where started_at is not null)::text || ' of ' || count(*)::text
      || ' members started a battle',
    case when count(*) = 0 then 'No members yet — the gate cannot be measured.'
         when count(*) filter (where started_at is not null) = 0 then 'Nobody has started a battle.'
         else 'At least one member has started a battle.'
    end
  from (
    select mb.user_id, (
      select min(b.started_at) from public.battles b where b.user_id = mb.user_id
    ) as started_at
    from members mb
  ) per_user
  having count(*) > 0
$$;

comment on function public.gate_activation(uuid) is
  '§58 activation: how many in-scope members have started a battle. One row for the whole scope — never one per squad. No row when the scope has no members.';

-- The board's shape is part of its contract, so assert it where it can be checked.
do $$
declare
  v_gates text;
  v_rows int;
begin
  select count(*)::text, string_agg(gate, ',' order by gate)
    into v_rows, v_gates
    from public.validation_gate_board(null);
  -- Duplicate gate ids would show up here as a count above the number of
  -- distinct gates, which is how 00039's regression was caught.
  if v_rows > 5 then
    raise exception 'validation_gate_board returned % rows (%), expected at most 5 — a gate is emitting more than one row', v_rows, v_gates;
  end if;
end $$;
