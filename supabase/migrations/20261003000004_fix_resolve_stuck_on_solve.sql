-- Fix for 20261003000003: resolve_stuck_on_solve referenced `new.battle_id`,
-- but battles has no such column — its primary key is `id` (challenge_id is a
-- different thing, added in 20261003000000).
--
-- Impact of the bug: the trigger raised on every battle solve, so
-- UPDATE battles SET outcome='solved' failed outright. Shipping the repair as
-- its own migration rather than editing the applied one.

create or replace function public.resolve_stuck_on_solve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.stuck_requests
     set status = 'resolved'
   where user_id = new.user_id
     and problem_slug = new.problem_slug
     and status <> 'resolved'
     and battle_id = new.id;
  return new;
end $$;