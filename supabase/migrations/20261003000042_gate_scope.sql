-- Fix: the gates ignored p_squad_id, so naming a squad meant "all squads".
--
-- 00039 and 00040 added the demo exclusion with this predicate, repeated in five
-- functions:
--
--     where p_squad_id is not null or exists (
--             select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)
--
-- Which reads as "if a squad was named, take everything". So
-- `gate_activation(p_squad_id => '<a squad with no members>')` reported on all
-- seven members in the database and said "0 of 7 members started a battle" while
-- the caller had asked about an empty squad.
--
-- The intent, stated once:
--
--     p_squad_id IS NULL      -> every non-demo squad in the product
--     p_squad_id IS NOT NULL  -> exactly that squad, demo or not
--
-- A researcher who opens the demo squad on purpose should see it — the banner
-- says what it is. Only the platform-wide view excludes demo squads, because only
-- that view can be mistaken for a cohort.
--
-- Extracted into one helper rather than a fifth copy of the predicate, because the
-- copies are what let this drift in the first place.

create or replace function public.validation_scope_has(p_squad_id uuid, p_row_squad uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_squad_id is not null then p_row_squad = p_squad_id
    else exists (
      select 1 from public.squads s where s.id = p_row_squad and not s.is_demo
    )
  end;
$$;

comment on function public.validation_scope_has(uuid, uuid) is
  'The §58 scope rule, in one place: a named squad is that squad exactly; the platform-wide view excludes demo squads.';

create or replace function public.gate_activation(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  with members as (
    select distinct m.user_id
    from public.squad_members m
    where public.validation_scope_has(p_squad_id, m.squad_id)
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
        where public.validation_scope_has(p_squad_id, m.squad_id)) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where public.validation_scope_has(p_squad_id, m.squad_id))) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where public.validation_scope_has(p_squad_id, m.squad_id))
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
        where public.validation_scope_has(p_squad_id, m.squad_id)) as n_members,
      (select count(*) from public.approaches a where a.user_id in
        (select m.user_id from public.squad_members m
          where public.validation_scope_has(p_squad_id, m.squad_id))) as written,
      (select count(*) from public.primers p where p.author_id in
        (select m.user_id from public.squad_members m
          where public.validation_scope_has(p_squad_id, m.squad_id))) as primers,
      (select count(*) from public.notebook_notes n
        where n.fork_of is not null and n.owner_id in
          (select m.user_id from public.squad_members m
            where public.validation_scope_has(p_squad_id, m.squad_id))) as copied
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
        where public.validation_scope_has(p_squad_id, m.squad_id)) as n_members,
      (select count(distinct date_trunc('week', e.created_at))
       from public.problem_events e
       where e.user_id in (select m.user_id from public.squad_members m
         where public.validation_scope_has(p_squad_id, m.squad_id))
         and e.kind in ('solved', 'revisited')
         and e.created_at > now() - interval '21 days') as active_weeks
  ) c
  where c.n_members > 0
$$;

create or replace function public.gate_organic(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'organic', c.referred > 0,
    c.referred::text || ' accounts joined through somebody''s invite link',
    case when c.referred = 0
      then 'No referred joins yet. This gate only became measurable at Loop D — before it, a signup arriving through an invite link could not be tied to the inviter.'
      else 'Invites are attributed to a person, so this is one specific member recruiting, not a squad-wide number.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where public.validation_scope_has(p_squad_id, m.squad_id)) as n_members,
      -- Scoped to the members in scope, so a referral counts only for a squad the
      -- invitee actually belongs to. Counting every invited profile in the
      -- installation lit this gate for every squad at once.
      (select count(*) from public.profiles p
        where p.invited_by is not null
          and p.active_squad_id is not null
          and public.validation_scope_has(p_squad_id, p.active_squad_id)) as referred
  ) c
  where c.n_members > 0
$$;

create or replace function public.validation_test_status(p_squad_id uuid default null)
returns table (member_count bigint, observation_count bigint, squad_count bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.squad_members m
      where public.validation_scope_has(p_squad_id, m.squad_id)),
    (select count(*) from public.validation_observations o
      where p_squad_id is null or o.squad_id = p_squad_id),
    (select count(distinct m.squad_id) from public.squad_members m
      where public.validation_scope_has(p_squad_id, m.squad_id))
$$;

grant execute on function public.validation_scope_has(uuid, uuid) to anon, authenticated;
