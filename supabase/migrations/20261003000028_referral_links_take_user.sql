-- Fix public.my_referral_links().
--
-- It filtered on `(select auth.uid())`, which is correct for a browser client
-- and always NULL for the service client the route uses — the service client is
-- not tied to any session, so the function matched nothing and every member saw
-- an empty list.
--
-- This is the second time in this feature: attribute_join's silent failure and
-- now this. `auth.uid()` cannot be read server-side without a forwarded JWT, so
-- a server-side caller must be told who it is asking about.
--
-- The user id is a parameter rather than derived, and the function is granted
-- to service_role only, so a caller cannot ask about somebody else's links.
create or replace function public.my_referral_links(p_user uuid)
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
  where r.referrer_id = p_user
  order by r.joins desc, r.opens desc
$$;

comment on function public.my_referral_links(uuid) is
  'Loop D: one member''s own links and what came through them. Takes the user id explicitly because auth.uid() is NULL for a service-role caller; granted to service_role so it cannot be pointed at somebody else''s rows.';

revoke execute on function public.my_referral_links(uuid) from anon, authenticated;
grant execute on function public.my_referral_links(uuid) to service_role;
