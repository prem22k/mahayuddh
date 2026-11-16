-- One leaderboard for both tabs.
--
-- Until now the Global tab ranked in SQL (global_leaderboard, five fixed
-- segments) while the Squad tab downloaded every profile and sorted in the
-- browser by metric and time window. The two boards had different filters, and
-- the squad filters drawn above the Global tab did nothing there.
--
-- public.leaderboard ranks once, here, for either scope:
--   p_scope   'global' everyone, or 'squad' the caller's active squad (taken
--             from auth.uid(), never a parameter, so nobody can ask for
--             another squad's board)
--   p_metric  verified | solves | streak | hard | rating | improved | pattern
--   p_window  week | month | all. Applies to verified, solves, improved and
--             pattern; streak, hard and rating are point-in-time values.
--
-- Verified "all" is the LeetCode-synced lifetime total (the old squad board and
-- the old "Most solved" segment); verified in a window counts solve events
-- whose source is LeetCode. Solves count solved and revisited events, as the
-- old "Rising" segment did.
--
-- The global board lists only people with something to rank (no wall of
-- zeros); the squad board lists every member. Ties share a rank (dense rank),
-- unrated people rank last on contest rating. p_only_user returns just that
-- person's row with their rank among everyone, for the "you are #N" bar.
--
-- It is plpgsql building one query per call from fixed fragments (inputs are
-- bound parameters), not one catch-all SQL statement: a single generic plan
-- for seven metrics and two scopes scanned every event for a squad of eight
-- and matched pattern topics once per event. Benchmarked 2026-11-17 on a
-- scratch copy (20k profiles, 1M events): worst call 2193 ms -> 262 ms, squad
-- calls 35-52 ms -> under 6 ms, identical rows across 504 parameter cases.
--
-- global_leaderboard stays until no deployed client calls it.

create index if not exists problem_events_created_idx
  on public.problem_events (created_at desc);

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
    select array_agg(sm.user_id) into v_members from public.squad_members sm where sm.squad_id = v_squad;
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
           where exists (select 1 from unnest(pr.topics) t where t ilike ''%'' || $3 || ''%''))' || v_events || '
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
  using v_members, v_since, v_pattern, p_only_user,
        least(greatest(coalesce(p_limit, 25), 1), 100), greatest(coalesce(p_offset, 0), 0);
end $$;

comment on function public.leaderboard(text, text, text, text, boolean, uuid, int, int) is
  'Both leaderboard tabs. Scope global or the caller''s own squad; metric verified|solves|streak|hard|rating|improved|pattern; window week|month|all. Dense rank, paginated (max 100).';

revoke all on function public.leaderboard(text, text, text, text, boolean, uuid, int, int) from public;
grant execute on function public.leaderboard(text, text, text, text, boolean, uuid, int, int) to anon, authenticated;
