-- Step 27 — fix gates that reported failure for an empty squad (follow-up to 00029).
--
-- 00029 gave gate_activation a `having count(*) > 0` guard so a squad with no
-- members returned no row. When gate_social was rewritten as a scalar aggregate
-- the guard was lost, and gate_learning, gate_retention and gate_organic never
-- had one. So those four returned a row for an empty squad: passed = false,
-- measured = "0 challenges sent", detail = "No members yet."
--
-- The detail was honest and the verdict was not. buildGates() maps a present row
-- to pass/fail, so an empty squad displayed four red failures, and the board
-- showed 4 fails instead of 5 unknowns. §76 says a no means stop adding surface
-- area — a gate board that manufactures noes from an empty roster argues for
-- deleting a product nobody has tried yet.
--
-- Caught by tests/integration/validation.mjs, which was written for exactly this.
--
-- Fix: a WHERE on the wrapper subquery, so "no members" means no row and the
-- verdict stays unknown. Same shape as gate_activation, applied consistently.

create or replace function public.gate_social(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'social', c.n_sent > 0,
    c.n_sent::text || ' challenges sent, ' || c.n_done::text || ' completed',
    case when c.n_sent = 0
      then 'Nobody has sent a challenge. §59 asks whether one happens naturally by day 3, and that is an observation, not something this query can see.'
      else 'No surface in the product instructs sending a challenge, so these are unprompted. It cannot show intent.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)
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
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.approaches a where a.user_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as written,
      (select count(*) from public.primers p where p.author_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as primers,
      (select count(*) from public.notebook_notes n
        where n.fork_of is not null and n.owner_id in
          (select m.user_id from public.squad_members m
            where p_squad_id is null or m.squad_id = p_squad_id)) as copied
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
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(distinct date_trunc('week', e.created_at))
       from public.problem_events e
       where e.user_id in (select m.user_id from public.squad_members m
         where p_squad_id is null or m.squad_id = p_squad_id)
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
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.profiles p
        where p.invited_by is not null
          and (p_squad_id is null or p.active_squad_id = p_squad_id)) as referred
  ) c
  where c.n_members > 0
$$;

comment on function public.gate_social(uuid) is
  '§58 social activation. Returns no row when the scope has no members, so an empty squad reads as unknown rather than as a failure.';
comment on function public.gate_learning(uuid) is
  '§58 learning behaviour. Writes and copies only; reading leaves no row. No row when the scope has no members.';
comment on function public.gate_retention(uuid) is
  '§58 retention: distinct weeks with a solve in the last 21 days. No row when the scope has no members.';
comment on function public.gate_organic(uuid) is
  '§58 organic growth. Measurable only since Loop D. No row when the scope has no members.';
