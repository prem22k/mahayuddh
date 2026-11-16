-- Squads are private unless their admins make them public.
--
-- Until now every squad, its member list, goals, seasons, recaps and
-- milestones were readable by anyone, signed in or not. A private squad now
-- shows outsiders its name and its rank on the squad leaderboard, nothing
-- else. Members see everything, as before. Joining by invite code is
-- unchanged: the code is the invitation, and the join preview reads with the
-- service role.
--
-- Every existing squad becomes private (the owner's choice for launch); the
-- landing page's demo squad stays public so the logged-out demo still works.

alter table public.squads
  add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'public'));

update public.squads set visibility = 'public' where is_demo;

-- Browsers read squads column by column (20261117000000 locked invite_code).
grant select (visibility) on public.squads to anon, authenticated;

-- One rule for every squad-owned table. Security definer so policies on
-- squad_members can call it without recursing into their own policy.
create or replace function public.can_see_squad(p_squad uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.squads s where s.id = p_squad and s.visibility = 'public')
      or exists (select 1 from public.squad_members m where m.squad_id = p_squad and m.user_id = auth.uid())
$$;

revoke all on function public.can_see_squad(uuid) from public;
grant execute on function public.can_see_squad(uuid) to anon, authenticated;

drop policy if exists "Squads publicly readable" on public.squads;
create policy "Squads readable when public or yours" on public.squads
  for select using (public.can_see_squad(id));

drop policy if exists "Squad members publicly readable" on public.squad_members;
create policy "Squad members readable when the squad is public or yours" on public.squad_members
  for select using (public.can_see_squad(squad_id));

drop policy if exists "Squad goals publicly readable" on public.squad_goals;
create policy "Squad goals readable when the squad is public or yours" on public.squad_goals
  for select using (public.can_see_squad(squad_id));

drop policy if exists "Squad seasons publicly readable" on public.squad_seasons;
create policy "Squad seasons readable when the squad is public or yours" on public.squad_seasons
  for select using (public.can_see_squad(squad_id));

drop policy if exists "Squad recaps publicly readable" on public.squad_recaps;
create policy "Squad recaps readable when the squad is public or yours" on public.squad_recaps
  for select using (public.can_see_squad(squad_id));

drop policy if exists "Squad milestones publicly readable" on public.squad_milestones;
create policy "Squad milestones readable when the squad is public or yours" on public.squad_milestones
  for select using (public.can_see_squad(squad_id));

-- Only a squad admin changes who can see it. squads' UPDATE policy goes by
-- created_by, but admins are squad_members.role = 'admin'; this accepts both.
create or replace function public.set_squad_visibility(p_squad uuid, p_visibility text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_visibility not in ('private', 'public') then
    raise exception 'Visibility is private or public.';
  end if;
  if not exists (
       select 1 from public.squad_members m
       where m.squad_id = p_squad and m.user_id = auth.uid() and m.role = 'admin')
     and not exists (
       select 1 from public.squads s where s.id = p_squad and s.created_by = auth.uid()) then
    raise exception 'Only a squad admin can change who sees the squad.';
  end if;
  update public.squads set visibility = p_visibility where id = p_squad;
  return p_visibility;
end $$;

revoke all on function public.set_squad_visibility(uuid, text) from public, anon;
grant execute on function public.set_squad_visibility(uuid, text) to authenticated;

-- Squads against squads, like guilds: LeetCode-verified solves per member, so
-- a focused three-person squad can beat a crowd. Private squads appear with
-- their name and rank only; size and visibility are shown to everyone only for
-- public squads (and to members for their own). Demo squads do not compete.
create or replace function public.squad_leaderboard(
  p_window text default 'week',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  squad_id uuid,
  name text,
  avatar_url text,
  is_public boolean,
  is_mine boolean,
  member_count int,
  value numeric,
  rank int,
  total_count int
)
language sql stable security definer set search_path = public as $$
  with params as (
    select case p_window
      when 'week' then now() - interval '7 days'
      when 'month' then now() - interval '30 days'
    end as since
  ),
  members as (
    select m.squad_id, m.user_id
    from public.squad_members m
    join public.squads s on s.id = m.squad_id
    where not s.is_demo
  ),
  per_member as (
    select mb.squad_id, mb.user_id,
      case when (select since from params) is null then
        (select coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0)
         from public.profiles p where p.id = mb.user_id)
      else
        (select count(*) from public.problem_events e
         where e.user_id = mb.user_id and e.kind = 'solved'
           and e.metadata->>'source' = 'leetcode'
           and e.created_at > (select since from params))
      end as solves
    from members mb
  ),
  scored as (
    select s.id, s.name, s.avatar_url, s.visibility = 'public' as is_public,
      exists (select 1 from public.squad_members me where me.squad_id = s.id and me.user_id = auth.uid()) as is_mine,
      count(pm.user_id)::int as members,
      round(coalesce(sum(pm.solves), 0)::numeric / greatest(count(pm.user_id), 1), 1) as value
    from public.squads s
    join per_member pm on pm.squad_id = s.id
    group by s.id
  ),
  eligible as (
    select * from scored where value > 0 or is_mine
  ),
  ranked as (
    select e.*, dense_rank() over (order by e.value desc)::int as rnk, count(*) over ()::int as total
    from eligible e
  )
  select r.id, r.name, r.avatar_url, r.is_public, r.is_mine,
         case when r.is_public or r.is_mine then r.members end,
         r.value, r.rnk, r.total
  from ranked r
  order by r.rnk, r.name
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.squad_leaderboard(text, int, int) from public;
grant execute on function public.squad_leaderboard(text, int, int) to anon, authenticated;
