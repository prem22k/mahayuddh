-- Two fixes found by running the functions against the live database.
--
-- 1. notify_contest_reminders failed with `record "c" is not assigned yet` and
--    therefore sent nothing at all. In plpgsql a FOR-loop target is not
--    assigned until the query returns, so referencing c.id in that query's WHERE
--    clause reads an unassigned record. The subquery needs its own table alias.
--    The contest reminder was the feature that could not fire at all.
--
-- 2. The "most improved" segment counted people who got FASTER.
--    (array_agg(duration_sec order by created_at desc))[1] >=
--    (array_agg(duration_sec order by created_at asc))[1]
--    is true when the two events share a created_at: Postgres is free to return
--    the same element first in both directions, so first == last and the test
--    passes. Two solves logged in one batch land in exactly that situation, so
--    a batch import looked like a plateau on every problem. Fixed with a
--    deterministic tiebreak on id, which is insertion order.

create or replace function public.notify_contest_reminders(p_within interval default interval '24 hours')
returns int language plpgsql security definer set search_path = public as $$
declare
  c record;
  members uuid[];
  m uuid;
  sent int := 0;
begin
  for c in
    -- `ct` is required: c is the loop target and is unassigned while this
    -- query runs, so c.id here raises "record c is not assigned yet".
    select ct.id, ct.title, ct.starts_at
    from public.contests ct
    where ct.starts_at > now()
      and ct.starts_at <= now() + p_within
      -- Idempotent by dedupe key, so the cron can run as often as it likes.
      and not exists (
        select 1 from public.notifications n
        where n.kind = 'contest' and n.dedupe_key = 'contest:' || ct.id::text
      )
  loop
    select array_agg(sm.user_id) into members
    from public.squad_members sm;

    foreach m in array coalesce(members, '{}'::uuid[]) loop
      insert into public.notifications (user_id, kind, title, body, deep_link, dedupe_key)
      values (
        m,
        'contest',
        c.title || ' starts soon',
        'In ' || greatest(1, floor(extract(hour from (c.starts_at - now()))))::int
          || ' hours. Compete, then compare approaches.',
        '/leaderboard',
        'contest:' || c.id::text
      )
      on conflict do nothing;
      if found then sent := sent + 1; end if;
    end loop;
  end loop;

  return sent;
end $$;

comment on function public.notify_contest_reminders(interval) is
  '§36 contest ritual reminder. Idempotent by dedupe_key so the cron can run it as often as it likes.';

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
    -- "Most improved": a genuine before/after on the same problem.
    --
    -- The id tiebreak is load-bearing. Two solves written in one batch share a
    -- created_at, and without a secondary sort Postgres may return the same
    -- duration first in both directions — which made first == last, the
    -- `last >= first` test pass, and every batch import look like a plateau on
    -- every problem it touched.
    select improved.user_id, count(*) as gains
    from (
      select
        e.user_id,
        e.problem_slug,
        (array_agg(e.duration_sec order by e.created_at asc, e.id asc))[1] as first_sec,
        (array_agg(e.duration_sec order by e.created_at desc, e.id desc))[1] as last_sec
      from public.problem_events e
      where e.kind in ('solved', 'revisited')
        and e.duration_sec is not null
        and e.created_at > now() - interval '90 days'
      group by e.user_id, e.problem_slug
      having count(*) >= 2
         and (array_agg(e.duration_sec order by e.created_at desc, e.id desc))[1]
             >= (array_agg(e.duration_sec order by e.created_at asc, e.id asc))[1]
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
      when 'improved' then coalesce(i.gains, 0) || ' problems got slower'
      when 'pattern' then coalesce(pa.solves, 0) || ' solves touching ' || p_pattern
      else 'lifetime solves'
    end as segment_label,
    a.last_active_at
  from public.profiles p
  left join activity a on a.user_id = p.id
  left join pattern_activity pa on pa.user_id = p.id and p_pattern is not null
  left join improvements i on i.user_id = p.id
  where
    -- A segment with nothing in it is empty rather than silently falling back to
    -- lifetime totals. Showing the all-time table under a "rising" label would
    -- be the dishonest version of this feature.
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
