-- LeetCode syncs flooded the squad feed with nameless "solved a problem" rows
-- and counted old solves as solved today.
--
-- mark_solved_from_leetcode stamped every imported slug with now(): the status,
-- the problem_events history row and a feed row each. It also put the slug in
-- feed_events.object_id and left problem_slug NULL, so the card had no name to
-- show. On 2026-11-07 one sync of LeetCode's 20 most recent submissions wrote
-- 20 such rows at the same instant.
--
-- Now:
--   - Callers that know when a problem was solved (recent submissions, battle
--     verify) pass p_solved_at, and every row uses that time.
--   - Callers that don't (history and session imports) get a time just before
--     the user joined Mahayuddh, so a backfill never reads as today's or this
--     week's work. The history row carries imported = true.
--   - The feed gets one named row per solve from the last 48 hours, and a
--     single "synced N solves" row for everything older.
--   - Existing rows are repaired: names filled in, same-instant bursts merged.

drop function if exists public.mark_solved_from_leetcode(uuid, text[]);

create or replace function public.mark_solved_from_leetcode(
  p_user_id uuid,
  p_slugs text[],
  p_solved_at timestamptz[] default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
  newly_solved text[];
  v_verified boolean;
  v_source text;
  v_squad uuid;
  v_before timestamptz;
  v_older int;
  v_slugs text[];
  v_at timestamptz[];
  v_known boolean[];
begin
  select leetcode_verified_at is not null, active_squad_id,
         least(now(), coalesce(created_at, now())) - interval '1 day'
    into v_verified, v_squad, v_before
  from public.profiles where id = p_user_id;
  v_verified := coalesce(v_verified, false);
  v_before := coalesce(v_before, now() - interval '1 day');
  v_source := case when v_verified then 'leetcode' else 'self' end;

  -- Only a verified handle's submissions may promote a manual "attempted"
  -- flag (preserve_attempted_on_manual_import enforces it).
  perform set_config('app.allow_attempted_promotion', case when v_verified then 'on' else 'off' end, true);

  -- One entry per slug with the time it was solved: the caller's, never later
  -- than now, or v_before when the caller doesn't know. Kept in arrays rather
  -- than a temp table, which a SECURITY DEFINER function shouldn't rely on.
  select coalesce(array_agg(slug), '{}'), coalesce(array_agg(at), '{}'), coalesce(array_agg(known), '{}')
    into v_slugs, v_at, v_known
  from (
    select s.slug, least(coalesce(min(s.at), v_before), now()) as at, bool_or(s.at is not null) as known
    from unnest(p_slugs, coalesce(p_solved_at, '{}'::timestamptz[])) as s(slug, at)
    where s.slug is not null
    group by s.slug
  ) x;

  with ins as (
    insert into public.user_problem_status (user_id, problem_slug, status, solved_at)
    select p_user_id, i.slug, 'solved', i.at from unnest(v_slugs, v_at, v_known) as i(slug, at, known)
    on conflict (user_id, problem_slug) do update
      set status = 'solved', solved_at = excluded.solved_at
      where public.user_problem_status.status = 'attempted'
        and v_verified
    returning problem_slug
  )
  select coalesce(array_agg(problem_slug), '{}'), count(*) into newly_solved, affected from ins;

  -- Append-only history. Verified: one LeetCode event per slug, as before,
  -- including slugs already solved by hand. Unverified: an event only for a
  -- slug this call newly marked solved, and only if no solve is logged yet,
  -- so history never says solved while the status still says attempted.
  insert into public.problem_events (user_id, problem_slug, kind, metadata, created_at)
  select p_user_id, i.slug, 'solved',
         jsonb_build_object('source', v_source) || case when i.known then '{}'::jsonb else '{"imported": true}'::jsonb end,
         i.at
  from unnest(v_slugs, v_at, v_known) as i(slug, at, known)
  where (v_verified or i.slug = any(newly_solved))
    and not exists (
      select 1 from public.problem_events e
      where e.user_id = p_user_id
        and e.problem_slug = i.slug
        and e.kind = 'solved'
        and (not v_verified or e.metadata->>'source' = 'leetcode')
    )
  on conflict do nothing;

  -- Squad activity from LeetCode-only usage (anti-ghost, §50): a named row per
  -- recent solve, one summary row for the rest.
  if v_squad is not null and newly_solved <> '{}' then
    insert into public.feed_events
      (user_id, event_type, problem_slug, problem_title, difficulty, object_type, object_id, squad_id, metadata, created_at)
    select p_user_id, 'solve', i.slug, p.title, p.difficulty, 'problem', i.slug, v_squad,
           jsonb_build_object('duration_sec', null, 'source', v_source), i.at
    from unnest(v_slugs, v_at, v_known) as i(slug, at, known)
    left join public.problems p on p.title_slug = i.slug
    where i.slug = any(newly_solved)
      and i.known
      and i.at >= now() - interval '48 hours';

    select count(*) into v_older
    from unnest(v_slugs, v_at, v_known) as i(slug, at, known)
    where i.slug = any(newly_solved)
      and not (i.known and i.at >= now() - interval '48 hours');

    if v_older > 0 then
      insert into public.feed_events (user_id, event_type, object_type, squad_id, metadata)
      values (p_user_id, 'solve', 'import', v_squad,
              jsonb_build_object('count', v_older, 'source', v_source));
    end if;
  end if;

  return affected;
end $$;

revoke all on function public.mark_solved_from_leetcode(uuid, text[], timestamptz[]) from public, anon, authenticated;
grant execute on function public.mark_solved_from_leetcode(uuid, text[], timestamptz[]) to service_role;

-- Repair 1: name the rows the old function left nameless.
update public.feed_events fe
   set problem_slug = fe.object_id,
       problem_title = coalesce(fe.problem_title, p.title),
       difficulty = coalesce(fe.difficulty, p.difficulty)
  from public.problems p
 where fe.object_type = 'problem'
   and fe.problem_slug is null
   and p.title_slug = fe.object_id;

update public.feed_events
   set problem_slug = object_id
 where object_type = 'problem'
   and problem_slug is null
   and object_id ~ '^[a-z0-9-]{1,80}$';

-- Repair 2: a sync wrote one row per slug at a single instant. Five or more
-- such rows from one person at one instant become one summary row.
with bursts as (
  select user_id, created_at, squad_id, min(metadata->>'source') as source, count(*) as n
  from public.feed_events
  where event_type = 'solve' and object_type = 'problem'
  group by user_id, created_at, squad_id
  having count(*) >= 5
),
summary as (
  insert into public.feed_events (user_id, event_type, object_type, squad_id, metadata, created_at)
  select user_id, 'solve', 'import', squad_id,
         jsonb_build_object('count', n, 'source', coalesce(source, 'self')), created_at
  from bursts
  returning id
)
delete from public.feed_events fe
 using bursts b
 where fe.event_type = 'solve' and fe.object_type = 'problem'
   and fe.user_id = b.user_id and fe.created_at = b.created_at
   and fe.squad_id is not distinct from b.squad_id;
