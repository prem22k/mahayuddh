-- Step 26 Loop D — squad from referral (§57 Growth, §56).
--
-- squads.invite_code is a single shared 8-character capability per squad. That
-- means "who sent this link" is unanswerable: the link a member forwards to a
-- friend is the same link another member forwards to somebody else, so a signup
-- can be attributed to a squad but never to a person.
--
-- Step 26 asks for "squad creation from referral tracking" and §57's metric is
-- invites/active user. Neither is measurable without a token that identifies
-- the sender, so that is what this adds.
--
-- What the token does and does not do:
--
--   - It ATTRIBUTES. The invite code still authorises the join; a token cannot
--     grant membership in a squad its bearer cannot otherwise join.
--   - So a forged or stolen token misattributes credit, at worst. It cannot
--     create a membership. That asymmetry is the whole reason the design is safe
--     to expose the token in a URL.
--
-- One inviter per account, first one wins. Otherwise a member could walk
-- somebody through several links and overwrite the credit, and referral
-- attribution would be worth gaming.

create table if not exists public.squad_referrals (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade not null,
  referrer_id uuid references public.profiles(id) on delete cascade not null,
  -- Short, URL-safe, unguessable. Not the invite code: the code authorises,
  -- this only attributes.
  token text not null unique check (token ~ '^[A-Za-z0-9]{12,24}$'),
  opens int not null default 0,
  joins int not null default 0,
  created_at timestamp with time zone default now(),
  -- One link per person per squad, so "your link" is a stable thing you can put
  -- in a bio and re-send without minting new ones.
  unique (squad_id, referrer_id)
);

-- There is deliberately no "cannot refer yourself" constraint here: it is
-- enforced by the trigger (you must already be a member of the squad) and again
-- in attribute_join (a token cannot credit the bearer). A constraint comparing
-- two columns of this row cannot express either rule, and a check that is
-- always true is worse than no check at all.

create index if not exists squad_referrals_squad_idx on public.squad_referrals (squad_id);
create index if not exists squad_referrals_referrer_idx on public.squad_referrals (referrer_id);

-- Attribution lives on the person, once.
alter table public.profiles add column if not exists invited_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists joined_via_referral uuid references public.squad_referrals(id) on delete set null;

comment on column public.profiles.invited_by is
  'The person whose link brought this account here. Set once, first referrer wins, so referral credit cannot be overwritten or farmed.';
comment on column public.profiles.joined_via_referral is
  'The referral link used. joined_via_squad is derivable from it; kept so the join can be traced without joining the referrals table.';

-- Enforce "only a member can mint a link for a squad", and "first referrer
-- wins", in the database rather than in a route handler.
create or replace function public.assert_referral_referrer_is_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.squad_members m
    where m.squad_id = new.squad_id and m.user_id = new.referrer_id
  ) then
    raise exception 'Only a squad member can create a referral link for that squad';
  end if;
  return new;
end $$;

drop trigger if exists assert_referral_referrer_is_member on public.squad_referrals;
create trigger assert_referral_referrer_is_member
  before insert on public.squad_referrals
  for each row execute function public.assert_referral_referrer_is_member();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- PRIVATE by default. "Who recruited you" is social data, and a referral link
-- is forwardable, so the table is not world-readable even though the token in
-- the URL is.
alter table public.squad_referrals enable row level security;

-- Readable by the sender and by somebody they actually brought in — nobody else.
drop policy if exists "Referrer and invitee see a referral" on public.squad_referrals;
create policy "Referrer and invitee see a referral" on public.squad_referrals for select
  using (
    (select auth.uid()) = referrer_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.joined_via_referral = squad_referrals.id
    )
  );

drop policy if exists "Members create own referral links" on public.squad_referrals;
create policy "Members create own referral links" on public.squad_referrals for insert
  with check (
    (select auth.uid()) = referrer_id
    and exists (
      select 1 from public.squad_members m
      where m.squad_id = squad_referrals.squad_id and m.user_id = (select auth.uid())
    )
  );

-- No update policy: counters and tokens are written server-side only, so a client
-- cannot inflate its own open/join totals.

-- ── "Your link" and "how many came through it" ───────────────────────────────
create or replace function public.my_referral_links()
returns table (
  squad_id uuid,
  squad_name text,
  token text,
  invite_code text,
  opens int,
  joins int
)
language sql stable security definer set search_path = public as $$
  select
    r.squad_id,
    s.name,
    r.token,
    s.invite_code,
    r.opens,
    r.joins
  from public.squad_referrals r
  join public.squads s on s.id = r.squad_id
  where r.referrer_id = (select auth.uid())
  order by r.joins desc, r.opens desc
$$;

comment on function public.my_referral_links() is
  'Loop D: the sender''s own links and what came through them. Only ever the caller''s own rows.';

grant execute on function public.my_referral_links() to authenticated;

-- Attribute a join. Called only from the server-side join route.
--
-- Returns the referrer's username so the join page can say who invited you.
-- Returns nulls when there is no valid referral, which is the common case: the
-- invite code alone still works.
create or replace function public.attribute_join(
  p_referral_token text,
  p_squad_id uuid,
  p_user_id uuid
)
returns table (referrer_id uuid, referrer_username text, already_member boolean)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  prior uuid;
begin
  select * into r from public.squad_referrals
  where token = p_referral_token
    and squad_id = p_squad_id
  limit 1;

  if r is null then
    return query select null::uuid, null::text, false;
    return;
  end if;

  -- You cannot invite yourself, and a token belonging to a squad you are not
  -- joining is ignored rather than honoured.
  if r.referrer_id = p_user_id then
    return query select null::uuid, null::text, false;
    return;
  end if;

  -- First referrer wins. Credit is not overwritten.
  select invited_by into prior from public.profiles where id = p_user_id;
  if prior is null then
    update public.profiles
    set invited_by = r.referrer_id, joined_via_referral = r.id
    where id = p_user_id;

    update public.squad_referrals set joins = joins + 1 where id = r.id;
  end if;

  select p.username into prior from public.profiles p where p.id = r.referrer_id;

  return query select r.referrer_id, prior, false;
end $$;

comment on function public.attribute_join(text, uuid, uuid) is
  'Attributes a join to the referrer who sent the link. First referrer wins, self-invites are ignored, and an unknown token attributes nothing.';

grant execute on function public.attribute_join(text, uuid, uuid) to service_role;