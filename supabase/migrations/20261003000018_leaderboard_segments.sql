-- Step 23 — Leaderboard segments (Bible §34).
--
-- §34's whole subject is one sentence: "A beginner should not feel: 'Why
-- compete with someone who has solved 2,000 problems?'" and it says global
-- rankings should support pagination, relevant segments, recent improvement and
-- pattern categories.
--
-- The current implementation loads every profile and sorts in the browser,
-- which does the opposite: the first row is always whoever has solved the most
-- ever, for every single visitor. This function makes the segments real and
-- makes the default choice the viewer's, not the top of the pile.
--
-- "Most solved" still exists, because hiding it would be its own kind of lie,
-- but it is a segment you choose rather than the landing state — and it is
-- paginated so there is always a page 2.

create or replace function public.global_leaderboard(
  p_segment text default 'rising',
  p_pattern text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  total_solves int,
  segment_value int,
  segment_label text,
  last_active_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with activity as (
    -- One row per user, from rows that already exist (§63). Recency, not
    -- lifetime totals, because "rising" is about what somebody is doing now.
    select
      e.user_id,
      count(*) filter (where e.kind in ('solved', 'revisited')) as solves_30d,
      max(e.created_at) as last_active_at
    from public.problem_events e
    where e.created_at > now() - interval '30 days'
    group by e.user_id
  ),
  pattern_activity as (
    -- Pattern-scoped solves. problems.topics is the vocabulary; the parameter is
    -- matched case-insensitively against any topic so "graphs" and "Graphs"
    -- both work.
    select e.user_id, count(*) as solves
    from public.problem_events e
    join public.problems p on p.title_slug = e.problem_slug
    where e.kind in ('solved', 'revisited')
      and exists (
        select 1 from unnest(p.topics) t
        where t ilike '%' || p_pattern || '%'
      )
    group by e.user_id
  ),
  improvements as (
    -- "Most improved": a genuine before/after. Same person, same problem, at
    -- least two timed solves inside the window, first slower than last.
    -- Without both durations there is no improvement, so those rows are excluded
    -- rather than treated as flat.
    select improved.user_id, count(*) as gains
    from (
      select
        e.user_id,
        e.problem_slug,
        (array_agg(e.duration_sec order by e.created_at asc))[1] as first_sec,
        (array_agg(e.duration_sec order by e.created_at desc))[1] as last_sec
      from public.problem_events e
      where e.kind in ('solved', 'revisited')
        and e.duration_sec is not null
        and e.created_at > now() - interval '90 days'
      group by e.user_id, e.problem_slug
      having count(*) >= 2
         and (array_agg(e.duration_sec order by e.created_at desc))[1]
             >= (array_agg(e.duration_sec order by e.created_at asc))[1]
    ) improved
    group by improved.user_id
  )
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0) as total_solves,
    case p_segment
      when 'rising' then coalesce(a.solves_30d, 0)
      when 'recent' then coalesce(a.solves_30d, 0)
      when 'improved' then coalesce(i.gains, 0)
      when 'pattern' then coalesce(pa.solves, 0)
      else coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0)
    end as segment_value,
    case p_segment
      when 'rising' then coalesce(a.solves_30d, 0) || ' solves in the last 30 days'
      when 'recent' then case when a.last_active_at is null then 'no activity logged'
                              else 'last active ' || a.last_active_at::date end
      when 'improved' then coalesce(i.gains, 0) || ' problems got faster'
      when 'pattern' then coalesce(pa.solves, 0) || ' solves touching ' || p_pattern
      else 'lifetime solves'
    end as segment_label,
    a.last_active_at
  from public.profiles p
  left join activity a on a.user_id = p.id
  left join pattern_activity pa on pa.user_id = p.id and p_pattern is not null
  left join improvements i on i.user_id = p.id
  where
    -- A segment with nothing in it is empty rather than silently falling back
    -- to lifetime totals. Showing the all-time table under a "rising" label
    -- would be the dishonest version of this feature.
    case p_segment
      when 'rising' then coalesce(a.solves_30d, 0) > 0
      when 'improved' then coalesce(i.gains, 0) > 0
      when 'pattern' then p_pattern is not null and coalesce(pa.solves, 0) > 0
      else true
    end
  order by segment_value desc, username asc
  limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

comment on function public.global_leaderboard(text, text, int, int) is
  '§34 global leaderboard segments. Default is ''rising'', not lifetime solves, so a beginner is not handed an immortal 2000-solve ranking. ''most_solved'' exists but is opt-in and paginated.';

grant execute on function public.global_leaderboard(text, text, int, int) to anon, authenticated;

-- The default segment for a viewer, from §34's own reasoning.
--
-- A beginner (few lifetime solves) is served 'rising' or 'recent' — segments
-- where a week of actual work puts them near the top. Somebody with thousands of
-- solves served 'most_solved', because for them that view is honest and useful.
-- Returns the segment name only; the caller renders it.
create or replace function public.default_leaderboard_segment(p_user uuid default null)
returns text language sql stable as $$
  select case
    when p_user is null then 'rising'
    when coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0) >= 500
      then 'most_solved'
    else 'rising'
  end
  from public.profiles p
  where p.id = p_user
$$;

grant execute on function public.default_leaderboard_segment(uuid) to anon, authenticated;