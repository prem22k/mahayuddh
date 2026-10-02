-- Loop D: count an invite-link open atomically.
--
-- Written as a function rather than a read-then-write in the route so two
-- simultaneous opens cannot race the counter down. The route previously did a
-- read-modify-write, which loses a count whenever two people open the same
-- link at once — and an undercounted "was my link ignored?" number is worse
-- than no number.
create or replace function public.count_referral_open(p_referral_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update public.squad_referrals
  set opens = opens + 1
  where id = p_referral_id
  returning opens into n;
  return coalesce(n, 0);
end $$;

comment on function public.count_referral_open(uuid) is
  'Atomically increments a referral link''s open count. Never a client write: the counter exists to tell a member whether their link was ignored.';

grant execute on function public.count_referral_open(uuid) to service_role;
