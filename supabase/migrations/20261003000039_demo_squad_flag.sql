-- Step 3 — demo squad, and the flag that keeps it out of the §58 gates.
--
-- The plan asks for `seed_demo_squad.sql`: "5 fake members, leaderboard, 10
-- solves, 3 challenges, 2 primers, 1 season goal. Read-only, banner 'Demo —
-- join to interact'." A new visitor needs to see a squad that has already
-- happened, or the empty states are the only thing they can judge the product
-- by (§41 cold start).
--
-- `squads.is_demo` exists so the demo squad cannot quietly become evidence.
--
-- That is the part worth being careful about. Step 27's §58 gates read whatever
-- rows exist, and I have already spent this session fixing a gate board that
-- displayed synthetic test data as if it were a finding. A demo squad with ten
-- solves and three completed challenges would light up activation, social,
-- learning, retention and organic simultaneously — five green gates produced by
-- a seed file, read by a founder as "squads repeatedly practise". That is
-- exactly the false yes §76 says must stop surface area being added.
--
-- So the gates exclude demo squads by default and `validation_test_status`
-- counts only real ones. A demo squad is a shop window, not a cohort, and the
-- instrument must be able to tell the difference.
--
-- Read-only is not enforced by RLS here: demo members are real auth users with
-- real rows, and RLS has no concept of "seeded". What is enforced is that the
-- seeding is idempotent and scoped, so re-running replaces rather than
-- duplicates. The read-only promise in the UI is a labelling promise — the same
-- honesty bar as the rest of the app, and the seed never pretends to be a real
-- person's history.

alter table public.squads
  add column if not exists is_demo boolean not null default false;

create index if not exists squads_is_demo_idx on public.squads (is_demo);

comment on column public.squads.is_demo is
  'Seeded showcase squad. Excluded from the §58 validation gates: a demo squad must never be able to turn a gate green.';

-- ── Gates ────────────────────────────────────────────────────────────────────
-- Only p_squad_id IS NULL changes (the platform-wide view). Filtering an
-- explicitly-chosen squad is left alone: if a researcher opens the demo squad on
-- purpose, showing it is the honest answer, and the banner says it is a demo.

create or replace function public.gate_activation(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'activation',
    count(*) filter (where b.id is not null) > 0,
    count(distinct m.user_id) filter (where b.id is not null)::text
      || ' of ' || count(distinct m.user_id)::text || ' members started a battle',
    case when count(distinct m.user_id) = 0 then 'No members yet — the gate cannot be measured.'
         when count(distinct m.user_id) filter (where b.id is not null) = 0 then 'Nobody has started a battle.'
         else 'A battle was started by at least one member.'
    end
  from public.squad_members m
  left join public.battles b on b.user_id = m.user_id
  where (p_squad_id is not null or exists (
          select 1 from public.squads s where s.id = m.squad_id and not s.is_demo))
  group by m.squad_id
  having count(*) > 0
$$;

create or replace function public.gate_social(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'social', c.n_sent > 0,
    c.n_sent::text || ' challenges sent, ' || c.n_done::text || ' completed',
    case when c.n_sent = 0
      then 'Nobody has sent a challenge. §59 asks whether one happens naturally by day 3, and that is an observation, not something this query can see.'
      else 'These are PROMPTED, not unprompted: the product says "challenge someone" in at least six places, including a button after every solve. §58 asks about challenges sent without being instructed, so this number does not answer that. Read the §59 log for it.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is not null or exists (
          select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is not null or exists (
            select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is not null or exists (
            select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))
          and s.status = 'completed') as n_done
  ) c
  where c.n_members > 0
$$;

create or replace function public.gate_learning(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'learning', (c.written + c.copied) > 0,
    c.written::text || ' approaches written, ' || c.primers::text || ' primers, '
      || c.copied::text || ' things copied',
    case when (c.written + c.copied) = 0
      then 'Nobody has written or copied anything yet.'
      else 'Reading is not measurable from rows — only writes and copies are. A primer opened and closed leaves nothing behind.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is not null or exists (
          select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)) as n_members,
      (select count(*) from public.approaches a where a.user_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is not null or exists (
            select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))) as written,
      (select count(*) from public.primers p where p.author_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is not null or exists (
            select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))) as primers,
      (select count(*) from public.notebook_notes n
        where n.fork_of is not null and n.owner_id in
          (select m.user_id from public.squad_members m
            where p_squad_id is not null or exists (
              select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))) as copied
  ) c
  where c.n_members > 0
$$;

create or replace function public.gate_retention(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'retention', c.active_weeks >= 2,
    c.active_weeks::text || ' distinct weeks with a solve',
    case when c.active_weeks < 2
      then 'One active week is not retention.'
      else 'Two or more weeks with a solve inside the last 21 days.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is not null or exists (
          select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)) as n_members,
      (select count(distinct date_trunc('week', e.created_at))
       from public.problem_events e
       where e.user_id in (select m.user_id from public.squad_members m
         where p_squad_id is not null or exists (
           select 1 from public.squads sq where sq.id = m.squad_id and not sq.is_demo))
         and e.kind in ('solved', 'revisited')
         and e.created_at > now() - interval '21 days') as active_weeks
  ) c
  where c.n_members > 0
$$;

create or replace function public.validation_test_status(p_squad_id uuid default null)
returns table (member_count bigint, observation_count bigint, squad_count bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.squad_members m
      where p_squad_id is not null or exists (
        select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)),
    (select count(*) from public.validation_observations o
      where p_squad_id is null or o.squad_id = p_squad_id),
    (select count(distinct m.squad_id) from public.squad_members m
      where p_squad_id is not null or exists (
        select 1 from public.squads s where s.id = m.squad_id and not s.is_demo))
$$;

comment on function public.validation_test_status(uuid) is
  'Member and observation counts for the scope. Demo squads are excluded when the scope is platform-wide: a shop window is not a cohort.';

-- validation_squads gains the flag so the UI can label the picker honestly.
-- Changing a function's return type is not a CREATE OR REPLACE, so the old
-- signature has to go first.
drop function if exists public.validation_squads();
create or replace function public.validation_squads()
returns table (squad_id uuid, name text, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.is_demo
  from public.squads s
  where exists (select 1 from public.squad_members m where m.squad_id = s.id)
  order by s.is_demo, s.name
$$;

grant execute on function public.validation_squads() to anon, authenticated;