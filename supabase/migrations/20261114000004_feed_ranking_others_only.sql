-- The feed called ordinary solves "Proven useful" and buried fresh ones.
--
-- feed_usefulness is meant to count what OTHER developers did because of a
-- post (§20: a useful post "changes what another developer does next"). Four
-- of its terms didn't:
--   revisits             counted the author's own solves, including the solve
--                        that made the post, so every solve scored >= 2
--   challenge_completions with no problem_slug, counted every challenge the
--                        author ever had completed
--   discussion_depth     counted replies on every discussion the author ever
--                        started, whatever this post was
--   copies (primer)      counted every fork in the system once this primer
--                        had one
-- Each term is now tied to this post and to other people. And the Squad tab is
-- newest first, as its own description says.

create or replace function public.feed_usefulness(p_event public.feed_events)
returns numeric language sql stable security definer set search_path = public as $$
  with copies as (
    -- Somebody else copied the shared object into their notebook.
    select count(*)::numeric as n
    from public.notebook_notes n
    where p_event.object_id is not null
      and n.fork_of::text = p_event.object_id
      and n.owner_id <> p_event.user_id
      and (
        (p_event.object_type = 'note' and n.fork_of_type is null)
        or n.fork_of_type = p_event.object_type
      )
  ),
  challenge_completions as (
    -- Somebody finished a challenge this author sent them on this problem.
    select count(*)::numeric as n
    from public.suggestions s
    where p_event.problem_slug is not null
      and s.from_user = p_event.user_id
      and s.to_user <> p_event.user_id
      and s.status = 'completed'
      and s.problem_slug = p_event.problem_slug
  ),
  follow_on_solves as (
    -- Somebody else solved or revisited this problem in the two weeks after
    -- the post. Not proof the post caused it, but it is the next thing another
    -- developer did on the same problem.
    select count(distinct e.user_id)::numeric as n
    from public.problem_events e
    where p_event.problem_slug is not null
      and e.problem_slug = p_event.problem_slug
      and e.user_id <> p_event.user_id
      and e.kind in ('solved', 'revisited')
      and e.created_at > p_event.created_at
      and e.created_at <= p_event.created_at + interval '14 days'
  ),
  discussion_depth as (
    -- Other people replying to this discussion.
    select count(distinct r.author_id)::numeric as n
    from public.discussion_replies r
    where p_event.object_type = 'discussion'
      and r.discussion_id::text = p_event.object_id
      and r.author_id <> p_event.user_id
      and r.deleted_at is null
  ),
  pattern_link as (
    -- §20 "pattern relevance". A pattern-linked object is a teaching signal:
    -- it points at a reusable idea rather than at one problem.
    select case when p_event.object_type in ('primer', 'approach') then 2.0 else 0.0 end as n
  )
  select
      4 * (select n from copies)
    + 3 * (select n from challenge_completions)
    + 2 * (select n from follow_on_solves)
    + 1 * (select n from discussion_depth)
    + (select n from pattern_link)
$$;

comment on function public.feed_usefulness(public.feed_events) is
  '§20 usefulness weight: what other developers did because of this post. Copies, challenge completions, follow-on solves within 14 days, distinct repliers, pattern linkage. Never the author''s own activity; no likes.';

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
  ),
  ranked as (
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
  )
  select r.id, r.user_id, r.event_type, r.problem_title, r.problem_slug, r.difficulty,
         r.squad_id, r.object_type, r.object_id, r.metadata, r.created_at, r.usefulness, r.score
  from ranked r
  -- Squad is chronological (§19: "Activity, mostly chronological"): the
  -- people you chose, newest first. Other scopes rank by score.
  order by case when p_scope = 'squad' then 0 else r.score end desc, r.created_at desc
$$;


ALTER FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) IS 'Feed rows for one scope. Squad is newest first; Global and Following rank by §20 usefulness with recency decay. The viewer is auth.uid(); p_viewer is ignored. Squad scope needs membership, Global shows only feed_event_is_global rows, and no scope shows another squad''s private rows. Blocks and own reports are applied server-side.';
