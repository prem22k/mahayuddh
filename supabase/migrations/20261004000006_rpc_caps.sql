-- Wave B trust-hardening: cap RPC pagination at 100 rows (defense in depth).
--
-- App-side caps (Math.min(limit,100)) already live in lib/data/leaderboard.ts
-- (global_leaderboard) and lib/data/feed.ts (get_ranked_feed). These
-- CREATE OR REPLACE definitions add the server-side backstop so a caller that
-- bypasses the app (direct RPC with p_limit=100000) still gets at most 100.
-- Copied from supabase/schema.sql (get_ranked_feed ~lines 782-834,
-- global_leaderboard ~lines 844-927); the ONLY change in each body is the
-- limit line gaining LEAST(...,100). Nothing else altered.

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



CREATE OR REPLACE FUNCTION "public"."global_leaderboard"("p_segment" "text" DEFAULT 'rising'::"text", "p_pattern" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "total_solves" integer, "segment_value" integer, "segment_label" "text", "last_active_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;


ALTER FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) IS '§34 segments. ''improved'' counts problems whose most recent timed solve was strictly faster than the first, and only where the two solves have distinct timestamps — identical timestamps have no recoverable order, so no claim is made. Default is ''rising'', so a beginner is not handed an immortal 2000-solve ranking.';
