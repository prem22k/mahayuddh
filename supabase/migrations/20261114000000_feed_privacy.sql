-- Feed privacy. Two leaks, one rule.
--
-- 1. feed_events was readable by anyone (`using (true)` since 20260828000001),
--    so every squad's stuck asks, challenges and solves were one REST call away.
-- 2. get_ranked_feed is SECURITY DEFINER and trusted its arguments: Global was
--    `when 'global' then true`, Squad never checked that the caller is in
--    p_squad_id, and blocks keyed off a caller-supplied p_viewer.
--
-- The rule, used by both the table policy and the RPC so they cannot drift:
-- a row is visible to you when it is yours, when you are in its squad, or when
-- it is a kind of event meant for everyone (feed_event_is_global).

-- What Global may show. Solves and "got faster" are already public through
-- user_problem_status and profiles; a discussion is global only when its author
-- chose that. Stuck asks, challenges, completions, teach and resource posts are
-- written from the squad composer with no visibility choice, so they stay in
-- the squad.
create or replace function public.feed_event_is_global(p_event_type text, p_metadata jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_event_type in ('solve', 'solved', 'improve')
      or (p_event_type = 'discuss' and coalesce(p_metadata->>'visibility', '') = 'global');
$$;

grant execute on function public.feed_event_is_global(text, jsonb) to anon, authenticated;

drop policy if exists "Allow public read access for feed_events" on public.feed_events;
drop policy if exists "Feed events visible to owner, squad, or everyone when global" on public.feed_events;
create policy "Feed events visible to owner, squad, or everyone when global"
  on public.feed_events for select
  using (
    (select auth.uid()) = user_id
    or public.feed_event_is_global(event_type, metadata)
    or (
      squad_id is not null
      and exists (
        select 1 from public.squad_members m
        where m.squad_id = feed_events.squad_id
          and m.user_id = (select auth.uid())
      )
    )
  );

-- p_viewer is kept in the signature so existing callers keep working, but it
-- is ignored: the viewer is whoever the JWT says, never an argument.
CREATE OR REPLACE FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid" DEFAULT NULL::"uuid", "p_viewer" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "user_id" "uuid", "event_type" "text", "problem_title" "text", "problem_slug" "text", "difficulty" "text", "squad_id" "uuid", "object_type" "text", "object_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "usefulness" numeric, "score" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with viewer as (
    select (select auth.uid()) as id
  ),
  scoped as (
    select fe.*
    from public.feed_events fe, viewer v
    where fe.event_type <> 'squad_milestone'
      and (
        case p_scope
          -- Squad: only for members of that squad.
          when 'squad' then fe.squad_id = p_squad_id
            and exists (
              select 1 from public.squad_members m
              where m.squad_id = p_squad_id and m.user_id = v.id
            )
          when 'global' then public.feed_event_is_global(fe.event_type, fe.metadata)
          when 'following' then exists (
            select 1 from public.follows f
            where f.follower_id = v.id and f.followed_id = fe.user_id
          )
          else false
        end
      )
      -- Every scope: a row from a squad you are not in shows only when it is
      -- meant for everyone. Following someone does not open their squad.
      and (
        fe.user_id = v.id
        or public.feed_event_is_global(fe.event_type, fe.metadata)
        or (fe.squad_id is not null and exists (
          select 1 from public.squad_members m
          where m.squad_id = fe.squad_id and m.user_id = v.id
        ))
      )
      -- Blocks are applied here, in the database. Blocking in the client would
      -- still deliver the blocked activity to the device.
      and not exists (
        select 1 from public.user_blocks b
        where b.blocker_id = v.id and b.blocked_id = fe.user_id
      )
      and not exists (
        select 1 from public.feed_reports r
        where r.reporter_id = v.id and r.event_id = fe.id
      )
    order by fe.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  )
  select
    s.id, s.user_id, s.event_type, s.problem_title, s.problem_slug, s.difficulty,
    s.squad_id, s.object_type, s.object_id, s.metadata, s.created_at,
    public.feed_usefulness(s) as usefulness,
    -- Recency: a post's usefulness decays over days so the feed stays live
    -- without discarding a genuinely useful resource. 7-day half-life-ish
    -- curve via exp(-age_hours / 168).
    public.feed_usefulness(s) * exp(-greatest(extract(epoch from (now() - s.created_at)) / 3600, 0) / 168)
    -- Squad events keep a flat floor so a fresh squad is never empty (§50).
    + case when p_scope = 'squad' then 0.5 else 0 end
    as score
  from scoped s
  order by score desc, created_at desc
$$;

ALTER FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) IS '§20-ranked feed rows for one scope. The viewer is auth.uid(); p_viewer is ignored. Squad scope needs membership, Global shows only feed_event_is_global rows, and no scope shows another squad''s private rows. Blocks and own reports are applied server-side.';
