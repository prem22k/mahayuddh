-- The "most improved" segment still lied, and the tiebreak I added made it worse.
--
-- 20261003000019 broke ties on `id` to make ordering deterministic. That was
-- wrong: problem_events.id is a random uuid, not a sequence. For two solves
-- written in the same statement they share a created_at, so the id order is
-- arbitrary — and whether a problem counted as improved came down to which
-- random uuid happened to sort lower.
--
-- Concretely: 300s then 900s counted as an improvement whenever the 900 row's
-- uuid sorted first, and as no improvement the other way round. Observed
-- flapping between runs on the same fixture.
--
-- There is no correct order to recover here. Two solves inside the same
-- millisecond genuinely have no chronology, so any claim about which came first
-- is unsupported. The honest rule is to decline to claim it:
--
--     min(created_at) <> max(created_at)
--
-- Solves logged by separate actions have distinct timestamps and are measured
-- normally. A batch import with one timestamp produces no improvement claims at
-- all, which is the correct and conservative outcome — the alternative was
-- asserting an improvement rate the data cannot support.

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
        min(e.created_at) as first_at,
        max(e.created_at) as last_at,
        (array_agg(e.duration_sec order by e.created_at asc))[1]  as first_sec,
        (array_agg(e.duration_sec order by e.created_at desc))[1] as last_sec
      from public.problem_events e
      where e.kind in ('solved', 'revisited')
        and e.duration_sec is not null
        and e.created_at > now() - interval '90 days'
      group by e.user_id, e.problem_slug
      having count(*) >= 2
         -- No order, no claim. See the migration header.
         and min(e.created_at) <> max(e.created_at)
         -- Strictly faster. "No change" is not an improvement.
         and (array_agg(e.duration_sec order by e.created_at desc))[1]
             <  (array_agg(e.duration_sec order by e.created_at asc))[1]
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
  '§34 segments. ''improved'' counts problems whose most recent timed solve was strictly faster than the first, and only where the two solves have distinct timestamps — identical timestamps have no recoverable order, so no claim is made. Default is ''rising'', so a beginner is not handed an immortal 2000-solve ranking.';