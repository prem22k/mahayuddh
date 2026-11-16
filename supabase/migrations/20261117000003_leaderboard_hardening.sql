-- Follow-ups from the independent review of the 2026-11-17 work.
--
-- 1. leaderboard(scope 'squad') trusted profiles.active_squad_id: an empty
--    squad (no member rows) fell through to the global board, and a stale
--    pointer to a squad the caller is not in showed that squad's roster.
--    Now the caller must be a member, and an empty squad is an empty board.
-- 2. "By pattern" matched the typed text as an ILIKE pattern, so % or _
--    matched every topic. It is escaped and matched literally.
-- 3. leaderboard_snapshots was readable by everyone, and squad snapshots list
--    each member's id, rank and score: a private squad's roster could be read
--    from its rank history. Squad snapshots now follow can_see_squad();
--    global ones stay public.
-- 4. squad_leaderboard returned a private squad's id to outsiders, which could
--    be matched to its members elsewhere; it is now null for private squads
--    that are not the caller's. An unknown window returned all-time results;
--    it now returns nothing, like leaderboard() does.
--
-- (The snapshot route now also refuses squads the caller is not in.)

create or replace function public.leaderboard(
  p_scope text default 'global',
  p_metric text default 'verified',
  p_window text default 'week',
  p_pattern text default null,
  p_linked_only boolean default false,
  p_only_user uuid default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  leetcode_username text,
  leetcode_verified boolean,
  rank int,
  value int,
  total_count int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := case p_window
    when 'week' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
  end;
  v_pattern text := nullif(btrim(p_pattern), '');
  v_members uuid[];          -- null: everyone (global)
  v_squad uuid;
  v_events text;             -- shared WHERE for event-based metrics
  v_vals text;               -- (user_id, value) for the chosen metric
  v_board text;
begin
  if p_metric not in ('verified', 'solves', 'streak', 'hard', 'rating', 'improved', 'pattern')
     or p_scope not in ('global', 'squad')
     or (p_metric = 'pattern' and v_pattern is null) then
    return;
  end if;

  if p_scope = 'squad' then
    select me.active_squad_id into v_squad from public.profiles me where me.id = auth.uid();
    if v_squad is null then
      return;
    end if;
    -- The caller must still be in that squad (a stale active_squad_id must not
    -- show someone else's roster), and an empty squad is an empty board, not
    -- the global one: v_members null means "everyone" below.
    select array_agg(sm.user_id) into v_members
    from public.squad_members sm
    where sm.squad_id = v_squad
      and exists (select 1 from public.squad_members me where me.squad_id = v_squad and me.user_id = auth.uid());
    if v_members is null then
      return;
    end if;
  end if;

  -- Only fixed SQL fragments are concatenated; every input travels as a
  -- bound parameter ($1 members, $2 since, $3 pattern), so each call is
  -- planned for what it actually asks.
  v_events := case when v_since is not null then ' and e.created_at > $2' else '' end
           || case when v_members is not null then ' and e.user_id = any($1)' else '' end;

  v_vals := case
    when p_metric = 'verified' and v_since is not null then
      'select e.user_id, count(*)::int as value from public.problem_events e
       where e.kind = ''solved'' and e.metadata->>''source'' = ''leetcode''' || v_events || ' group by e.user_id'
    when p_metric = 'verified' then
      'select p.id as user_id, coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0) as value
       from public.profiles p'
    when p_metric = 'solves' then
      'select e.user_id, count(*)::int as value from public.problem_events e
       where e.kind in (''solved'', ''revisited'')' || v_events || ' group by e.user_id'
    when p_metric = 'streak' then
      'select p.id as user_id, coalesce(p.streak, 0) as value from public.profiles p'
    when p_metric = 'hard' then
      'select p.id as user_id, coalesce(p.total_hard, 0) as value from public.profiles p'
    when p_metric = 'rating' then
      'select p.id as user_id, round(p.contest_rating)::int as value from public.profiles p'
    when p_metric = 'improved' then
      -- Two timed solves of one problem with distinct timestamps, the latest
      -- strictly faster than the first. One ordered aggregate per problem.
      'select g.user_id, count(*)::int as value from (
         select e.user_id, array_agg(e.duration_sec order by e.created_at) as secs,
                min(e.created_at) as first_at, max(e.created_at) as last_at
         from public.problem_events e
         where e.kind in (''solved'', ''revisited'') and e.duration_sec is not null' || v_events || '
         group by e.user_id, e.problem_slug
         having count(*) >= 2
       ) g
       where g.first_at <> g.last_at and g.secs[array_length(g.secs, 1)] < g.secs[1]
       group by g.user_id'
    else
      -- Pattern: match the 4k problems' topics once, then count events by slug.
      'select e.user_id, count(*)::int as value from public.problem_events e
       where e.kind in (''solved'', ''revisited'')
         and e.problem_slug in (
           select pr.title_slug from public.problems pr
           where exists (select 1 from unnest(pr.topics) t where t ilike $3))' || v_events || '
       group by e.user_id'
  end;

  -- Global lists people with something to rank; a squad lists every member.
  v_board := case when v_members is null then
      'select p.id, p.username, p.avatar_url, p.leetcode_username, p.leetcode_verified_at is not null as lv, v.value
       from vals v join public.profiles p on p.id = v.user_id
       where v.value > 0'
    else
      -- A member with nothing in the window counts 0; only an unrated
      -- contest rating stays empty.
      'select p.id, p.username, p.avatar_url, p.leetcode_username, p.leetcode_verified_at is not null as lv, '
      || case when p_metric = 'rating' then 'v.value' else 'coalesce(v.value, 0)' end || ' as value
       from public.profiles p left join vals v on v.user_id = p.id
       where p.id = any($1)'
    end
    || case when coalesce(p_linked_only, false) then ' and p.leetcode_username is not null' else '' end;

  return query execute
    'with vals as (' || v_vals || '),
     board as (' || v_board || '),
     ranked as (
       select b.*, dense_rank() over (order by coalesce(b.value, -1) desc)::int as rnk,
              count(*) over ()::int as total
       from board b
     )
     select r.id, r.username, r.avatar_url, r.leetcode_username, r.lv, r.rnk, r.value, r.total
     from ranked r
     where $4 is null or r.id = $4
     order by r.rnk, r.username
     limit $5 offset $6'
  -- The pattern is matched literally: % and _ in what someone typed are not
  -- wildcards.
  using v_members, v_since,
        '%' || replace(replace(replace(v_pattern, '\', '\\'), '%', '\%'), '_', '\_') || '%',
        p_only_user,
        least(greatest(coalesce(p_limit, 25), 1), 100), greatest(coalesce(p_offset, 0), 0);
end $$;

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
  -- A private squad's id stays hidden from outsiders: with it, anyone could
  -- match the squad to its members through other public columns.
  select case when r.is_public or r.is_mine then r.id end, r.name, r.avatar_url, r.is_public, r.is_mine,
         case when r.is_public or r.is_mine then r.members end,
         r.value, r.rnk, r.total
  from ranked r
  where p_window in ('week', 'month', 'all')
  order by r.rnk, r.name
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

drop policy if exists "Leaderboard snapshots publicly readable" on public.leaderboard_snapshots;
create policy "Leaderboard snapshots readable when the board is" on public.leaderboard_snapshots
  for select using (
    case
      when scope ~ '^squad:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.can_see_squad(substring(scope from 7)::uuid)
      when scope like 'squad%' then false
      else true
    end
  );
