-- Leaving a squad leaves profiles.active_squad_id pointing at it.
--
-- leaveSquad only deletes the squad_members row, and active_squad_id is written
-- server-side only (/api/squads/switch), so after leaving, Home, the feed and
-- new solves kept using the squad the user no longer belongs to.
--
-- Whenever a membership row goes (leaving, an admin removing a member, a squad
-- being deleted), a user whose active squad it was moves to the squad they
-- joined most recently, or to none. Doing it in the database means every way a
-- membership can end is covered, not only the Leave button.
create or replace function public.reset_active_squad_on_leave()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set active_squad_id = (
       select m.squad_id
         from public.squad_members m
        where m.user_id = old.user_id
        order by m.joined_at desc nulls last
        limit 1
     )
   where p.id = old.user_id
     and p.active_squad_id = old.squad_id;

  return null;
end $$;

revoke all on function public.reset_active_squad_on_leave() from public;
revoke all on function public.reset_active_squad_on_leave() from anon, authenticated;

drop trigger if exists reset_active_squad_on_leave on public.squad_members;
create trigger reset_active_squad_on_leave
  after delete on public.squad_members
  for each row execute function public.reset_active_squad_on_leave();

-- People who already left a squad are stuck on it. Same rule, once.
update public.profiles p
   set active_squad_id = (
     select m.squad_id
       from public.squad_members m
      where m.user_id = p.id
      order by m.joined_at desc nulls last
      limit 1
   )
 where p.active_squad_id is not null
   and not exists (
     select 1 from public.squad_members m
      where m.user_id = p.id and m.squad_id = p.active_squad_id
   );
