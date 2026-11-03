-- Production's get_ranked_feed filtered `event_type <> 'squad_million'` (a
-- typo in the version applied through the dashboard on 2026-10-14), so squad
-- milestone events leaked into the ranked feed. The repo's 20261004000006
-- always had 'squad_milestone'; this re-creates the function from that file
-- verbatim so production matches. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid" DEFAULT NULL::"uuid", "p_viewer" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "user_id" "uuid", "event_type" "text", "problem_title" "text", "problem_slug" "text", "difficulty" "text", "squad_id" "uuid", "object_type" "text", "object_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "usefulness" numeric, "score" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with scoped as (
    select fe.*
    from public.feed_events fe
    where fe.event_type <> 'squad_milestone'
      and (
        case p_scope
          -- Squad is the default per §19: accountability against the people you
          -- chose, chronological. Ordering is handled by the score below, but a
          -- squad of five people wants recency to lead, not cumulative lifetime
          -- usefulness — see the squad weight.
          when 'squad' then fe.squad_id = p_squad_id
          when 'global' then true
          when 'following' then exists (
            select 1 from public.follows f
            where f.follower_id = p_viewer and f.followed_id = fe.user_id
          )
          else false
        end
      )
      -- Blocks are applied here, in the database. Blocking in the client would
      -- still deliver the blocked activity to the device.
      and not exists (
        select 1 from public.user_blocks b
        where b.blocker_id = p_viewer and b.blocked_id = fe.user_id
      )
      and not exists (
        select 1 from public.feed_reports r
        where r.reporter_id = p_viewer and r.event_id = fe.id
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
    -- Squad events keep a flat floor so a fresh squad is never empty (§50: a
    -- new squad with five users must generate activity without anybody posting
    -- anything). Recency alone already does this; the floor makes it explicit
    -- rather than incidental.
    + case when p_scope = 'squad' then 0.5 else 0 end
    as score
  from scoped s
  order by score desc, created_at desc
$$;


ALTER FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) IS '§20-ranked feed rows for one scope. Applies the viewer''s blocks and their own reports server-side. Squad scope carries a flat score floor so a new squad is never empty (§50).';

