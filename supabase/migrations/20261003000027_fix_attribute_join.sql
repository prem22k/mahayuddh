-- Fix public.attribute_join.
--
-- It reused one variable for two types: `prior uuid` was first assigned
-- profiles.invited_by (correct) and then assigned
-- `(select username from profiles ...)`, which is text. plpgsql raises
--
--   invalid input syntax for type uuid: "some_username_1"
--
-- so every attribution failed and the join silently attributed nobody. The
-- failure was silent in the route because the RPC error was not checked.
--
-- Fixed with a separate text variable. The token-attribution design is
-- unchanged: unknown tokens attribute nothing, self-invites are ignored, and
-- first referrer wins.
create or replace function public.attribute_join(
  p_referral_token text,
  p_squad_id uuid,
  p_user_id uuid
)
returns table (referrer_id uuid, referrer_username text, already_member boolean)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  prior_inviter uuid;
  referrer_name text;
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
  select invited_by into prior_inviter from public.profiles where id = p_user_id;
  if prior_inviter is null then
    update public.profiles
    set invited_by = r.referrer_id, joined_via_referral = r.id
    where id = p_user_id;

    update public.squad_referrals set joins = joins + 1 where id = r.id;
  end if;

  select p.username into referrer_name from public.profiles p where p.id = r.referrer_id;

  return query select r.referrer_id, referrer_name, false;
end $$;

comment on function public.attribute_join(text, uuid, uuid) is
  'Attributes a join to the referrer who sent the link. First referrer wins, self-invites are ignored, and an unknown token attributes nothing.';