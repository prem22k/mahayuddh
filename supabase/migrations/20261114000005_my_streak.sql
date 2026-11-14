-- The sidebar's streak was LeetCode's, and the wrong one.
--
-- It showed profiles.streak, which the LeetCode sync fills from
-- userCalendar.streak: LeetCode's longest streak, refreshed only when a sync
-- runs. A user whose best ever was 3 saw "3" with "Solve today to keep 3"
-- right after solving.
--
-- my_streak() is the caller's own streak from their solves here, on the same
-- days the squad grid uses (IST) and the same kinds ('solved', 'revisited').
-- A streak is alive while its last day is today or yesterday. Undated LeetCode
-- imports (metadata.imported) are not days the person practised.

create or replace function public.my_streak()
returns table (current_streak int, best_streak int, solved_today boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select distinct (e.created_at at time zone 'Asia/Kolkata')::date as d
    from public.problem_events e
    where e.user_id = (select auth.uid())
      and e.kind in ('solved', 'revisited')
      and coalesce(e.metadata->>'imported', 'false') <> 'true'
  ),
  today as (
    select (now() at time zone 'Asia/Kolkata')::date as t
  ),
  -- Consecutive days share d - row_number(): each group is one run.
  runs as (
    select max(d) as last_day, count(*)::int as len
    from (select d, d - (row_number() over (order by d))::int as grp from days) x
    group by grp
  )
  select
    coalesce((select r.len from runs r, today where r.last_day >= today.t - 1 order by r.last_day desc limit 1), 0),
    coalesce((select max(len) from runs), 0),
    exists (select 1 from days, today where days.d = today.t)
$$;

revoke all on function public.my_streak() from public, anon;
grant execute on function public.my_streak() to authenticated;
