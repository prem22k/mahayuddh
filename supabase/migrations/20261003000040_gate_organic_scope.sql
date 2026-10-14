-- Bring gate_organic in line with the other four gates (follow-up to 00039).
--
-- 00039 excluded demo squads from activation, social, learning and retention, and
-- missed this one. The consequence was a false failure rather than a missed row:
--
--   gate                        rows   verdict
--   activation/social/learning/
--   retention                     0     unknown   <- correct
--   organic                       1     FAIL      <- wrong
--
-- gate_organic's member guard counts members across the scope, and seeding the
-- demo squad put five members in that count, so the gate became "measurable" and
-- then reported "0 accounts joined through somebody's invite link" — a fail
-- manufactured by a seed file, which is the exact failure mode the demo flag
-- exists to prevent.
--
-- Two problems fixed, not one:
--
--   1. Demo members are excluded, like everywhere else.
--   2. The referral count is scoped to members of the squads in scope. It was
--      counting every profile with invited_by set, worldwide, whenever the scope
--      was platform-wide — so one referred signup anywhere lit the gate for every
--      squad in the product. §58 asks whether "someone invites another person",
--      which is a fact about a squad, not about the installation.

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
        where p_squad_id is not null or exists (
          select 1 from public.squads s where s.id = m.squad_id and not s.is_demo)) as n_members,
      -- Scoped to the members counted above, so a referral only counts for a
      -- squad the invitee actually belongs to.
      (select count(*) from public.profiles p
        where p.invited_by is not null
          and p.active_squad_id is not null
          and (p_squad_id is not null
               or exists (select 1 from public.squads s
                          where s.id = p.active_squad_id and not s.is_demo))) as referred
  ) c
  where c.n_members > 0
$$;

comment on function public.gate_organic(uuid) is
  '§58 organic growth. Referrals counted among members of in-scope, non-demo squads. Measurable only since Loop D. No row when the scope has no members.';

-- The §58 board assembles these five functions, so nothing else needs updating.