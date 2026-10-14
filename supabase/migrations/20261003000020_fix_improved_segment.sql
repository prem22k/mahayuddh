-- Correct the "most improved" segment, which was measuring the opposite.
--
-- The previous version selected problems where the most recent timed solve was
-- NO BETTER than the first:
--
--     having last_sec >= first_sec
--
-- and then labelled those rows "N problems got faster". Those are people whose
-- solves got slower. So a segment called "Most improved" listed the people who
-- improved least, and its own label stated the opposite of what it measured.
--
-- The integration test I wrote alongside it asserted the same inversion —
-- that somebody going 300s then 900s belongs in "most improved" — so the bug
-- was pinned in place by its own test rather than caught by it. Correcting the
-- direction here and the test below it.
--
-- Improvement is last_sec < first_sec: the most recent timed solve on the same
-- problem was strictly faster than the first. Strictly, so "no change" does
-- not count as improvement, which is the harder reading but the honest one.
--
-- Still requires two timed solves. One measurement cannot describe a change,
-- and a missing duration is not a fast solve.
--
-- The id tiebreak from 20261003000019 is kept and is still load-bearing: two
-- solves written in one batch share a created_at, so without a secondary sort
-- the same duration can come back first in both directions.

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
    select
      e.user_id,
      count(*) filter (where e.kind in ('solved', 'revisited')) as solves_30d,
      max(e.created_at) as last_active_at
    from public.problem_events e
    where e.created_at > now() - interval '30 days'
    group by e.user_id
  ),
  pattern_activity as (
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
    select improved.user_id, count(*) as gains
    from (
      select
        e.user_id,
        e.problem_slug,
        (array_agg(e.duration_sec order by e.created_at asc,  e.id asc ))[1] as first_sec,
        (array_agg(e.duration_sec order by e.created_at desc, e.id desc))[1] as last_sec
      from public.problem_events e
      where e.kind in ('solved', 'revisited')
        and e.duration_sec is not null
        and e.created_at > now() - interval '90 days'
      group by e.user_id, e.problem_slug
      -- Strictly faster. Strictly, because "no change" is not an improvement
      -- and a leaderboard should not award the label for standing still.
      having count(*) >= 2
         and (array_agg(e.duration_sec order by e.created_at desc, e.id desc))[1]
             <  (array_agg(e.duration_sec order by e.created_at asc,  e.id asc ))[1]
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
      -- Says "faster" because that is now what the segment measures. The label
      -- and the predicate have to agree, and the test asserts both.
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
  '§34 global leaderboard segments. ''improved'' counts problems whose most recent timed solve was strictly faster than the first. Default is ''rising'', not lifetime solves, so a beginner is not handed an immortal 2000-solve ranking.';