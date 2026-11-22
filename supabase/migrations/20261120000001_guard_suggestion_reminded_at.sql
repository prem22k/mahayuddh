-- The 24-hour reminder throttle is enforced by the authenticated server route.
-- Parties can still update their suggestion rows directly, so keep the throttle
-- column server-managed; otherwise a caller can clear reminded_at and bypass
-- the route's atomic compare-and-set repeatedly.
create or replace function public.guard_suggestion_reminded_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.reminded_at is distinct from old.reminded_at then
    raise exception 'reminded_at is maintained by the server';
  end if;
  return new;
end $$;

revoke all on function public.guard_suggestion_reminded_at() from public, anon, authenticated;

drop trigger if exists guard_suggestion_reminded_at on public.suggestions;
create trigger guard_suggestion_reminded_at
  before update of reminded_at on public.suggestions
  for each row execute function public.guard_suggestion_reminded_at();
