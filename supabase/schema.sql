-- ============================================================
-- Mahayuddh: canonical Supabase schema. Regenerate, do not hand-edit.
-- ============================================================
--
-- This file is the whole database: tables, functions, triggers, RLS policies and
-- grants, followed by the idempotent seed rows below. Running it against an empty
-- Supabase project reproduces the production schema exactly.
--
-- Provenance
-- ----------
-- It used to be hand-written, and it drifted. By Step 26 it was missing migrations
-- 10 through 28 — every table, function and policy from Phase 4, Phase 5, Loop C
-- and Loop D — while the README called it canonical and complete. A fresh install
-- from it produced a product with no feeds, no notifications, no leaderboards, no
-- recommendation, no AI gates, no attribution and no referral links.
--
-- It is now generated from the live database, which is the only version that can
-- be correct by construction. If you add a migration, apply it, then regenerate:
--
--     npx supabase db dump --file supabase/schema.sql --schema public
--     python3 scripts/make-schema-idempotent.py
--
-- and then re-append the seed block at the bottom, because a schema-only dump
-- carries no rows.
--
-- pg_dump output is correct but not re-runnable: 131 bare ADD CONSTRAINT, 118
-- bare CREATE POLICY and 68 bare CREATE INDEX statements all fail on a second
-- run. The script wraps the constraints in pg_constraint-guarded DO blocks,
-- prefixes the policies with DROP POLICY IF EXISTS, and adds IF NOT EXISTS to the
-- indexes. CREATE OR REPLACE FUNCTION / TRIGGER and CREATE TABLE IF NOT EXISTS are
-- already idempotent.
--
-- Verified: installed three times in a row against a clean Postgres 17 (roles and
-- the auth schema stubbed) with zero errors, after which all 15 RPCs and 43 tables
-- the app calls existed, and a trigger was observed firing rather than merely
-- being present.
-- The versioned migrations in supabase/migrations/ remain the source of truth;
-- this file is what a fresh install runs.
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select greatest(0, 30 - count(*)::int)
  from public.ai_calls
  where squad_id = p_squad
    and created_at > now() - interval '1 hour'
    and outcome not in ('refused', 'disabled')
$$;


ALTER FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") IS '§45 cost cap proxy: AI calls allowed for this squad in the last hour. Refused and disabled calls do not consume budget — a squad should not be charged for the guardrail stopping the model.';



CREATE OR REPLACE FUNCTION "public"."assert_referral_referrer_is_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public.squad_members m
    where m.squad_id = new.squad_id and m.user_id = new.referrer_id
  ) then
    raise exception 'Only a squad member can create a referral link for that squad';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."assert_referral_referrer_is_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("referrer_id" "uuid", "referrer_username" "text", "already_member" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  prior_inviter uuid;
  referrer_name text;
begin
  select * into r from public.squad_referrals
  where token = p_referral_token
    and squad_id = p_squad_id
  limit 1;

  if r is null then
    return query select null::uuid, null::text, false;
    return;
  end if;

  -- You cannot invite yourself, and a token belonging to a squad you are not
  -- joining is ignored rather than honoured.
  if r.referrer_id = p_user_id then
    return query select null::uuid, null::text, false;
    return;
  end if;

  -- First referrer wins. Credit is not overwritten.
  select invited_by into prior_inviter from public.profiles where id = p_user_id;
  if prior_inviter is null then
    update public.profiles
    set invited_by = r.referrer_id, joined_via_referral = r.id
    where id = p_user_id;

    update public.squad_referrals set joins = joins + 1 where id = r.id;
  end if;

  select p.username into referrer_name from public.profiles p where p.id = r.referrer_id;

  return query select r.referrer_id, referrer_name, false;
end $$;


ALTER FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") IS 'Attributes a join to the referrer who sent the link. First referrer wins, self-invites are ignored, and an unknown token attributes nothing.';



CREATE OR REPLACE FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  update public.squad_referrals
  set opens = opens + 1
  where id = p_referral_id
  returning opens into n;
  return coalesce(n, 0);
end $$;


ALTER FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") IS 'Atomically increments a referral link''s open count. Never a client write: the counter exists to tell a member whether their link was ignored.';



CREATE OR REPLACE FUNCTION "public"."create_discussion"("p_problem_slug" "text", "p_pattern_tags" "text"[], "p_body_md" "text", "p_visibility" "text" DEFAULT 'squad'::"text", "p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  me uuid := auth.uid();
  solves int;
  recent int;
  new_id uuid;
begin
  if me is null then
    raise exception 'Log in to post.';
  end if;

  -- Problem-linked and pattern-linked are CHECK constraints on the table, but
  -- a constraint violation surfaces as an opaque 23514. Check them here too so
  -- the message can say which one is missing.
  if coalesce(array_length(p_pattern_tags, 1), 0) < 1 then
    raise exception 'Tag at least one pattern so people learning it can find this.';
  end if;
  if p_problem_slug is null or p_problem_slug !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'Pick the problem this is about.';
  end if;
  if char_length(trim(coalesce(p_body_md, ''))) < 1 then
    raise exception 'Write something.';
  end if;
  if p_visibility not in ('squad', 'global') then
    raise exception 'Unknown visibility.';
  end if;

  -- §51: actionable. Checked before the rate limit so a spammy post costs one
  -- slot, not an hour of the user's budget.
  if not public.discussion_is_actionable(p_body_md) then
    raise exception 'Say what you tried and what the reader should try. "I solved it" is not a post.';
  end if;

  -- §51 rate limit.
  select count(*) into recent
  from public.discussions d
  where d.author_id = me and d.deleted_at is null
    and d.created_at > now() - interval '1 hour';
  if recent >= public.discussion_rate_limit() then
    raise exception 'You have posted % times in the last hour. Try again later.', public.discussion_rate_limit();
  end if;

  -- §51 public posting constraint.
  if p_visibility = 'global' then
    select count(*) into solves
    from public.problem_events e
    where e.user_id = me and e.kind in ('solved', 'revisited');
    if solves < public.global_post_min_solves() then
      raise exception 'Posting to Global needs % logged solves first. Your squad feed is open now.',
        public.global_post_min_solves();
    end if;
  end if;

  insert into public.discussions (author_id, problem_slug, pattern_tags, body_md, squad_id, visibility)
  values (me, p_problem_slug, p_pattern_tags, p_body_md, p_squad_id, p_visibility)
  returning id into new_id;

  -- §64: the feed never stores blobs. It points at the discussion.
  insert into public.feed_events (user_id, event_type, problem_slug, squad_id, object_type, object_id, metadata)
  values (me, 'discuss', p_problem_slug, p_squad_id, 'discussion', new_id::text,
          jsonb_build_object('visibility', p_visibility));

  return new_id;
end $_$;


ALTER FUNCTION "public"."create_discussion"("p_problem_slug" "text", "p_pattern_tags" "text"[], "p_body_md" "text", "p_visibility" "text", "p_squad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_discussion_reply"("p_discussion_id" "uuid", "p_body_md" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  me uuid := auth.uid();
  recent int;
  new_id uuid;
begin
  if me is null then
    raise exception 'Log in to reply.';
  end if;

  if not exists (
    select 1 from public.discussions d
    where d.id = p_discussion_id and d.deleted_at is null
  ) then
    raise exception 'That discussion is gone.';
  end if;

  select count(*) into recent
  from public.discussion_replies r
  where r.author_id = me and r.deleted_at is null
    and r.created_at > now() - interval '10 minutes';
  if recent >= public.reply_rate_limit() then
    raise exception 'Slow down a little.';
  end if;

  insert into public.discussion_replies (discussion_id, author_id, body_md)
  values (p_discussion_id, me, p_body_md)
  returning id into new_id;

  return new_id;
end $$;


ALTER FUNCTION "public"."create_discussion_reply"("p_discussion_id" "uuid", "p_body_md" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."default_leaderboard_segment"("p_user" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select case
    when p_user is null then 'rising'
    when coalesce(p.total_easy, 0) + coalesce(p.total_medium, 0) + coalesce(p.total_hard, 0) >= 500
      then 'most_solved'
    else 'rising'
  end
  from public.profiles p
  where p.id = p_user
$$;


ALTER FUNCTION "public"."default_leaderboard_segment"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discussion_is_actionable"("p_body" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select
    -- A question, or something the reader could be told to do.
    (
      p_body ~* '\?'
      or p_body ~* '(try|attempt|start|read|look at|compare|sketch|draw|write|explain|watch|notice|give up|revisit|practice)'
    )
    -- And none of the shapes §51 calls low quality: generic "I solved #100"
    -- posts, engagement bait, referral spam.
    and p_body !~* '(i solved|solved it|solved that|solved the problem|check this out|follow me|dm me|help me win|referral|boost|pls|plz)'
$$;


ALTER FUNCTION "public"."discussion_is_actionable"("p_body" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."discussion_is_actionable"("p_body" "text") IS '§51 actionability: has a question or an action for the reader, and is not one of the low-quality shapes the section names. Conjunction is deliberate — matching a low-quality phrase must REJECT, not accept.';



CREATE OR REPLACE FUNCTION "public"."discussion_rate_limit"() RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  -- Per hour. Posting a problem-linked discussion is a considered act; a
  -- per-minute limit would only stop bursts of the same thing.
  select 5
$$;


ALTER FUNCTION "public"."discussion_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_ai_ladder_ceiling"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  rank int;
  asked int;
  answered int;
begin
  if new.requested_level is null or new.answered_level is null then
    return new;
  end if;

  rank :=
    case new.answered_level
      when 'nudge' then 1 when 'pattern' then 2
      when 'direction' then 3 when 'full' then 4
    end;
  asked :=
    case new.requested_level
      when 'nudge' then 1 when 'pattern' then 2
      when 'direction' then 3 when 'full' then 4
    end;

  if rank > asked then
    -- Refuse rather than raise. The caller sees 'refused' and can show the
    -- user that the ladder held, which is a better outcome than a 500.
    new.outcome := 'refused';
    new.refusal_reason := 'answered above the requested ladder level';
    new.answered_level := new.requested_level;
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."enforce_ai_ladder_ceiling"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_stuck_reply_level"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  asked text;
  rank int;
  asked_rank int;
begin
  select level into asked from public.stuck_requests where id = new.request_id;
  if asked is null then
    raise exception 'Unknown stuck request';
  end if;
  rank := case new.level
    when 'nudge' then 1 when 'pattern' then 2
    when 'direction' then 3 else 4 end;
  asked_rank := case asked
    when 'nudge' then 1 when 'pattern' then 2
    when 'direction' then 3 else 4 end;
  if rank > asked_rank then
    raise exception 'That reply gives more help than the asker requested (%)', asked;
  end if;
  -- First real reply moves the request to 'helped' so the queue stops nagging.
  if new.accepted then
    update public.stuck_requests set status = 'helped' where id = new.request_id;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_stuck_reply_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_stuck_request_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  open_count int;
begin
  if new.status <> 'open' then
    return new;
  end if;
  select count(*) into open_count
  from public.stuck_requests
  where user_id = new.user_id and status = 'open';
  if open_count >= 3 then
    raise exception 'You already have 3 open stuck requests. Close one before asking again.';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_stuck_request_limit"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."feed_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "problem_title" "text",
    "problem_slug" "text",
    "difficulty" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "squad_id" "uuid",
    "object_type" "text",
    "object_id" "text",
    CONSTRAINT "feed_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['solved'::"text", 'streak'::"text", 'contest'::"text", 'suggested'::"text", 'completed'::"text", 'solve'::"text", 'teach'::"text", 'challenge'::"text", 'complete'::"text", 'improve'::"text", 'stuck'::"text", 'resource'::"text", 'squad_milestone'::"text", 'discuss'::"text"])))
);


ALTER TABLE "public"."feed_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with copies as (
    -- Successful copies of the shared object. notebook_notes.fork_of points at
    -- the note being copied, so a fork is a developer deciding this was worth
    -- taking into their own notebook.
    select count(*)::numeric as n
    from public.notebook_notes n
    where n.fork_of is not null
      and (
        (p_event.object_type = 'note' and n.fork_of::text = p_event.object_id)
        or (p_event.object_type = 'primer'
            and exists (select 1 from public.primers pr where pr.id::text = p_event.object_id and pr.fork_count > 0))
      )
  ),
  challenge_completions as (
    -- §20 "challenge completions": somebody finished a challenge this author
    -- sent. status is terminal, so this counts real finishes.
    select count(*)::numeric as n
    from public.suggestions s
    where s.from_user = p_event.user_id
      and s.status = 'completed'
      and (
        p_event.problem_slug is null
        or s.problem_slug = p_event.problem_slug
      )
  ),
  revisits as (
    -- §20 "revisits": the problem came back around, which is the whole point of
    -- the product. Counted for this author on this problem.
    select count(*)::numeric as n
    from public.problem_events e
    where e.user_id = p_event.user_id
      and e.kind in ('revisited', 'solved')
      and (p_event.problem_slug is null or e.problem_slug = p_event.problem_slug)
  ),
  discussion_depth as (
    -- §20 "meaningful discussion". Replies on a discussion this author started.
    -- Depth is the count of people who stayed with it.
    select count(*)::numeric as n
    from public.discussion_replies r
    join public.discussions d on d.id = r.discussion_id
    where d.author_id = p_event.user_id
      and d.deleted_at is null
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
    + 2 * (select n from revisits)
    + 1 * (select n from discussion_depth)
    + (select n from pattern_link)
$$;


ALTER FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") IS '§20 usefulness weight. Downstream actions only: copies, challenge completions, revisits, discussion depth, pattern linkage. No likes — §20 forbids likes as a competence signal and this schema has no likes column.';



CREATE OR REPLACE FUNCTION "public"."gate_activation"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with members as (
    select m.user_id, p.created_at
    from public.squad_members m
    join public.profiles p on p.id = m.user_id
    where p_squad_id is null or m.squad_id = p_squad_id
  ),
  first_battle as (
    select m.user_id, min(b.started_at) as at
    from members m
    left join public.battles b on b.user_id = m.user_id
    group by m.user_id
  )
  select
    'activation',
    count(*) filter (where f.at is not null) = count(*),
    count(*) filter (where f.at is not null)::text || ' of ' || count(*)::text || ' members started a battle',
    case when count(*) = 0 then 'No members yet — the gate cannot be measured.'
         when count(*) filter (where f.at is not null) = 0 then 'Nobody has started a battle.'
         else 'Median hours to first battle: ' || coalesce(
           (select round(avg(h))::text from (
              select extract(epoch from (f.at - m.created_at)) / 3600 as h
              from first_battle f join members m on m.user_id = f.user_id
              where f.at is not null
            ) s),
           'n/a'
         )
    end
  from first_battle f
  join members m on m.user_id = f.user_id
  having count(*) > 0
$$;


ALTER FUNCTION "public"."gate_activation"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gate_activation"("p_squad_id" "uuid") IS '§58 activation. Returns no row rather than a failure when there are no members, because "0% activation" over an empty squad is not a finding.';



CREATE OR REPLACE FUNCTION "public"."gate_learning"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'learning', (c.written + c.copied) > 0,
    c.written::text || ' approaches written, ' || c.primers::text || ' primers, '
      || c.copied::text || ' things copied',
    case when (c.written + c.copied) = 0
      then 'Nobody has written or copied anything yet.'
      else 'Reading is not measurable from rows — only writes and copies are. A primer opened and closed leaves nothing behind.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.approaches a where a.user_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as written,
      (select count(*) from public.primers p where p.author_id in
        (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as primers,
      (select count(*) from public.notebook_notes n
        where n.fork_of is not null and n.owner_id in
          (select m.user_id from public.squad_members m
            where p_squad_id is null or m.squad_id = p_squad_id)) as copied
  ) c
  where c.n_members > 0
$$;


ALTER FUNCTION "public"."gate_learning"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gate_learning"("p_squad_id" "uuid") IS '§58 learning behaviour. Writes and copies only; reading leaves no row. No row when the scope has no members.';



CREATE OR REPLACE FUNCTION "public"."gate_organic"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'organic', c.referred > 0,
    c.referred::text || ' accounts joined through somebody''s invite link',
    case when c.referred = 0
      then 'No referred joins yet. This gate only became measurable at Loop D — before it, a signup arriving through an invite link could not be tied to the inviter.'
      else 'Invites are attributed to a person, so this is one specific member recruiting, not a squad-wide number.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.profiles p
        where p.invited_by is not null
          and (p_squad_id is null or p.active_squad_id = p_squad_id)) as referred
  ) c
  where c.n_members > 0
$$;


ALTER FUNCTION "public"."gate_organic"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gate_organic"("p_squad_id" "uuid") IS '§58 organic growth. Measurable only since Loop D. No row when the scope has no members.';



CREATE OR REPLACE FUNCTION "public"."gate_retention"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'retention', c.active_weeks >= 2,
    c.active_weeks::text || ' distinct weeks with a solve',
    case when c.active_weeks < 2
      then 'One active week is not retention.'
      else 'Two or more weeks with a solve inside the last 21 days.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(distinct date_trunc('week', e.created_at))
       from public.problem_events e
       where e.user_id in (select m.user_id from public.squad_members m
         where p_squad_id is null or m.squad_id = p_squad_id)
         and e.kind in ('solved', 'revisited')
         and e.created_at > now() - interval '21 days') as active_weeks
  ) c
  where c.n_members > 0
$$;


ALTER FUNCTION "public"."gate_retention"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gate_retention"("p_squad_id" "uuid") IS '§58 retention: distinct weeks with a solve in the last 21 days. No row when the scope has no members.';



CREATE OR REPLACE FUNCTION "public"."gate_social"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'social', c.n_sent > 0,
    c.n_sent::text || ' challenges sent, ' || c.n_done::text || ' completed',
    case when c.n_sent = 0
      then 'Nobody has sent a challenge. §59 asks whether one happens naturally by day 3, and that is an observation, not something this query can see.'
      else 'No surface in the product instructs sending a challenge, so these are unprompted. It cannot show intent.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)
          and s.status = 'completed') as n_done
  ) c
  where c.n_members > 0
$$;


ALTER FUNCTION "public"."gate_social"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gate_social"("p_squad_id" "uuid") IS '§58 social activation. Returns no row when the scope has no members, so an empty squad reads as unknown rather than as a failure.';



CREATE OR REPLACE FUNCTION "public"."generate_squad_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alphabet, (random() * 31)::int + 1, 1);
  end loop;
  return code;
end $$;


ALTER FUNCTION "public"."generate_squad_code"() OWNER TO "postgres";


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
    limit greatest(coalesce(p_limit, 30), 1)
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
  limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;


ALTER FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) IS '§34 segments. ''improved'' counts problems whose most recent timed solve was strictly faster than the first, and only where the two solves have distinct timestamps — identical timestamps have no recoverable order, so no claim is made. Default is ''rising'', so a beginner is not handed an immortal 2000-solve ranking.';



CREATE OR REPLACE FUNCTION "public"."global_post_min_solves"() RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  select 3
$$;


ALTER FUNCTION "public"."global_post_min_solves"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_product_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.is_product_admin is distinct from new.is_product_admin
     and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'is_product_admin is set by the platform only';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_product_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  -- 22:00–08:00 UTC. Contest reminders and goal nudges respect it; a direct
  -- challenge from a person you know does not, because ignoring somebody who
  -- just challenged you is its own kind of noise.
  select extract(hour from p_at at time zone 'UTC') >= 22
      or extract(hour from p_at at time zone 'UTC') < 8
$$;


ALTER FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone) IS '§37 low-noise default: 22:00-08:00 UTC. Advisory nudges check this; direct person-to-person notices do not.';



CREATE OR REPLACE FUNCTION "public"."lock_suggestion_parties"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.from_user is distinct from old.from_user
    or new.to_user is distinct from old.to_user
    or new.problem_slug is distinct from old.problem_slug
    or new.sender_time_sec is distinct from old.sender_time_sec
    or new.beat_time is distinct from old.beat_time
    or new.deadline_at is distinct from old.deadline_at
    or new.parent_id is distinct from old.parent_id then
    raise exception 'suggestion parties, problem and challenge terms are immutable';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."lock_suggestion_parties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_solved_from_leetcode"("p_user_id" "uuid", "p_slugs" "text"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  affected int := 0;
  newly_solved text[];
begin
  perform set_config('app.allow_attempted_promotion', 'on', true);

  -- Append-only history, one solved event per slug that was NOT already solved
  -- in LeetCode. Re-syncs must not inflate the timeline.
  insert into public.problem_events (user_id, problem_slug, kind, metadata)
  select p_user_id, s, 'solved', jsonb_build_object('source', 'leetcode')
  from unnest(p_slugs) as s
  where not exists (
    select 1 from public.problem_events e
    where e.user_id = p_user_id
      and e.problem_slug = s
      and e.kind = 'solved'
      and e.metadata->>'source' = 'leetcode'
  )
  on conflict do nothing;

  with ins as (
    insert into public.user_problem_status (user_id, problem_slug, status, solved_at)
    select p_user_id, unnest(p_slugs), 'solved', now()
    on conflict (user_id, problem_slug) do update
      set status = 'solved', solved_at = now()
      where public.user_problem_status.status = 'attempted'
    returning problem_slug
  )
  select coalesce(array_agg(problem_slug), '{}'), count(*) into newly_solved, affected from ins;

  -- Squad activity from LeetCode-only usage (anti-ghost, §50). One event per
  -- newly promoted solve so a squad synced purely via LeetCode still has a feed.
  if newly_solved <> '{}' then
    insert into public.feed_events (user_id, event_type, object_type, object_id, squad_id, metadata)
    select p_user_id, 'solve', 'problem', s.slug,
      (select active_squad_id from public.profiles where id = p_user_id),
      jsonb_build_object('duration_sec', null, 'source', 'leetcode')
    from unnest(newly_solved) as s(slug)
    where exists (select 1 from public.profiles where id = p_user_id and active_squad_id is not null);
  end if;

  return affected;
end $$;


ALTER FUNCTION "public"."mark_solved_from_leetcode"("p_user_id" "uuid", "p_slugs" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_content_impact"() RETURNS TABLE("source_type" "text", "source_id" "uuid", "label" "text", "forks" integer, "completions" integer, "headline" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select 'approach'::text as source_type, a.id as source_id,
           a.problem_slug || ' approach' as label
    from public.approaches a, me where a.user_id = me.id
    union all
    select 'primer', p.id, p.title from public.primers p, me where p.author_id = me.id
    union all
    select 'resource', r.id, r.title from public.shared_resources r, me where r.author_id = me.id
  ),
  counts as (
    select
      m.source_type, m.source_id, m.label,
      (select count(*) from public.notebook_notes n
        where n.fork_of = m.source_id and n.fork_of_type = m.source_type) as forks,
      (select count(*) from public.content_impact ci
        where ci.source_id = m.source_id and ci.solved_at is not null) as completions
    from mine m
  )
  select
    c.source_type,
    c.source_id,
    c.label,
    c.forks,
    c.completions,
    -- §26: "Your primer helped 12 developers solve X". Said only when it is
    -- true. A completion always implies a fork, so a non-zero completion with
    -- zero forks would be a broken counter rather than a message.
    case
      when c.completions > 0 then
        'Helped ' || c.completions || ' ' || case when c.completions = 1 then 'developer' else 'developers' end || ' solve'
      when c.forks > 0 then
        c.forks::text || (case when c.forks = 1 then ' copy' else ' copies' end) || ', none solved the problem yet'
      else 'Nobody has copied this yet'
    end
  from counts c
  where c.forks > 0 or c.completions > 0
  order by c.completions desc, c.forks desc
$$;


ALTER FUNCTION "public"."my_content_impact"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."my_content_impact"() IS '§26 Loop C author view. Only objects somebody actually copied appear, so the panel cannot list a wall of zeroes.';



CREATE OR REPLACE FUNCTION "public"."my_referral_links"() RETURNS TABLE("squad_id" "uuid", "squad_name" "text", "token" "text", "invite_code" "text", "opens" integer, "joins" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.squad_id,
    s.name,
    r.token,
    s.invite_code,
    r.opens,
    r.joins
  from public.squad_referrals r
  join public.squads s on s.id = r.squad_id
  where r.referrer_id = (select auth.uid())
  order by r.joins desc, r.opens desc
$$;


ALTER FUNCTION "public"."my_referral_links"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."my_referral_links"() IS 'Loop D: the sender''s own links and what came through them. Only ever the caller''s own rows.';



CREATE OR REPLACE FUNCTION "public"."my_referral_links"("p_user" "uuid") RETURNS TABLE("squad_id" "uuid", "squad_name" "text", "token" "text", "invite_code" "text", "opens" integer, "joins" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.squad_id,
    s.name,
    r.token,
    s.invite_code,
    r.opens,
    r.joins
  from public.squad_referrals r
  join public.squads s on s.id = r.squad_id
  where r.referrer_id = p_user
  order by r.joins desc, r.opens desc
$$;


ALTER FUNCTION "public"."my_referral_links"("p_user" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."my_referral_links"("p_user" "uuid") IS 'Loop D: one member''s own links and what came through them. Takes the user id explicitly because auth.uid() is NULL for a service-role caller; granted to service_role so it cannot be pointed at somebody else''s rows.';



CREATE OR REPLACE FUNCTION "public"."normalize_leetcode_username"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.leetcode_username is not null then
    new.leetcode_username := lower(trim(new.leetcode_username));
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."normalize_leetcode_username"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_challenge_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;

  -- Tell the sender. "Your challenge was completed" is §37's fourth good example.
  insert into public.notifications (user_id, kind, title, body, deep_link, actor_id, dedupe_key)
  values (
    new.from_user,
    'challenge_completed',
    'Your challenge was completed',
    coalesce((select username from public.profiles where id = new.to_user), 'Someone')
      || ' finished ' || coalesce(new.problem_title, 'the problem') || '.',
    '/c/' || new.id::text,
    new.to_user,
    'challenge_completed:' || new.id::text
  )
  on conflict do nothing;

  return new;
end $$;


ALTER FUNCTION "public"."notify_challenge_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_challenge_received"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, kind, title, body, deep_link, actor_id, dedupe_key)
  values (
    new.to_user,
    'challenge',
    'Someone challenged you',
    coalesce(new.problem_title, 'A problem') || ' — beat their time or take it on.',
    '/c/' || new.id::text,
    new.from_user,
    'challenge:' || new.id::text
  )
  on conflict do nothing;

  -- §37: a challenge is one of the two explicitly good notifications and it is
  -- directed at one person, so it ignores quiet hours.
  --
  -- Deliberately no push() call from the trigger. A Postgres trigger cannot
  -- call lib/push.ts, and the alternatives — an http extension or a queue — are
  -- not worth it for one row. The row written above IS the queue: the app
  -- reads unread notifications and delivers pushes (lib/data/notifications.ts).
  -- That also means a push failure cannot roll back the challenge.

  return new;
end $$;


ALTER FUNCTION "public"."notify_challenge_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_contest_reminders"("p_within" interval DEFAULT '24:00:00'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."notify_contest_reminders"("p_within" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_contest_reminders"("p_within" interval) IS '§36 contest ritual reminder. Idempotent by dedupe_key so the cron can run it as often as it likes.';



CREATE OR REPLACE FUNCTION "public"."notify_goal_near_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  done int;
  remaining int;
  members uuid[];
  m uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select count(*) into done
  from public.problem_events e
  where e.created_at >= coalesce(new.deadline::timestamptz - interval '7 days', new.created_at)
    and e.kind in ('solved', 'revisited')
    and exists (
      select 1 from public.squad_members sm
      where sm.squad_id = new.squad_id and sm.user_id = e.user_id
    );

  remaining := new.target_count - done;
  if remaining > 3 or remaining < 1 then
    return new;
  end if;

  if public.in_quiet_hours() then
    return new;
  end if;

  select array_agg(user_id) into members from public.squad_members where squad_id = new.squad_id;
  foreach m in array coalesce(members, '{}'::uuid[]) loop
    insert into public.notifications (user_id, kind, title, body, deep_link, dedupe_key)
    values (
      m,
      'goal',
      'Squad goal almost done',
      'Your squad is ' || remaining || ' ' || case when remaining = 1 then 'solve' else 'solves' end
        || ' away from ' || new.title || '.',
      '/squad/' || new.squad_id::text,
      'goal:' || new.id::text
    )
    on conflict do nothing;
  end loop;

  return new;
end $$;


ALTER FUNCTION "public"."notify_goal_near_complete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_goal_near_complete"() IS '§37 goal nudge. One open notice per goal thanks to notifications_dedupe_open_unique, so it cannot stack.';



CREATE OR REPLACE FUNCTION "public"."notify_recap_ready"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  members uuid[];
  m uuid;
begin
  select array_agg(user_id) into members from public.squad_members where squad_id = new.squad_id;
  foreach m in array coalesce(members, '{}'::uuid[]) loop
    insert into public.notifications (user_id, kind, title, body, deep_link, dedupe_key)
    values (
      m,
      'recap',
      'Weekly recap ready',
      'How ' || coalesce((select name from public.squads where id = new.squad_id), 'your squad')
        || ' did the week of ' || new.week_start || '.',
      '/squad/' || new.squad_id::text || '/recaps',
      'recap:' || new.id::text
    )
    on conflict do nothing;
  end loop;
  return new;
end $$;


ALTER FUNCTION "public"."notify_recap_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preserve_attempted_on_manual_import"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'attempted'
    and new.status = 'solved'
    and current_setting('app.allow_attempted_promotion', true) is distinct from 'on' then
    new.status := old.status;
    new.solved_at := old.solved_at;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."preserve_attempted_on_manual_import"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_first_challenge_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Every squad containing both parties owns this challenge. A challenge to
  -- somebody outside any squad is not a squad wall event.
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  select sm.squad_id, 'first_challenge', 'First challenge sent',
         'Somebody decided a problem was worth handing to a squad mate.',
         coalesce(new.created_at, now())
  from public.squad_members sm
  where sm.user_id = new.from_user
    and exists (
      select 1 from public.squad_members other
      where other.squad_id = sm.squad_id and other.user_id = new.to_user
    )
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."record_first_challenge_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_first_member_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.squad_milestones (squad_id, kind, title, detail)
  values (new.squad_id, 'first_member', 'Squad formed', 'The first person joined this squad.')
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."record_first_member_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_goal_complete_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'goal_complete', 'Goal reached',
          left(new.title, 120), now())
  on conflict (squad_id, kind) do update
    set detail = excluded.detail, occurred_at = excluded.occurred_at;
  return new;
end $$;


ALTER FUNCTION "public"."record_goal_complete_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_season_complete_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status <> 'complete' or old.status = 'complete' then
    return new;
  end if;
  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'season_complete', 'Season complete', left(new.name, 120), now())
  on conflict (squad_id, kind) do update
    set detail = excluded.detail, occurred_at = excluded.occurred_at;
  return new;
end $$;


ALTER FUNCTION "public"."record_season_complete_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_solve_count_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  total int;
begin
  if new.kind not in ('solved', 'revisited') then
    return new;
  end if;

  select count(*) into total
  from public.problem_events e
  where e.user_id = new.user_id
    and e.kind in ('solved', 'revisited');

  -- Every squad the person belongs to owns the count, the same way a challenge
  -- belongs to every squad containing both parties. Picking one would be
  -- arbitrary when somebody is in three squads.
  if total >= 50 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    select sm.squad_id, 'milestone_solves', '50 solves',
           'Somebody here has logged 50 solves in this squad.',
           coalesce(new.created_at, now())
    from public.squad_members sm
    where sm.user_id = new.user_id
    on conflict (squad_id, kind) do nothing;
  end if;

  if total >= 100 then
    insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
    select sm.squad_id, 'milestone_solves_100', '100 solves',
           'The squad passed 100 logged solves.',
           coalesce(new.created_at, now())
    from public.squad_members sm
    where sm.user_id = new.user_id
    on conflict (squad_id, kind) do nothing;
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."record_solve_count_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_solve_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.outcome <> 'solved' or new.squad_id is null then
    return new;
  end if;

  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (new.squad_id, 'first_solve', 'First battle won',
          'Somebody in the squad got their first solve logged here.',
          coalesce(new.ended_at, now()))
  on conflict (squad_id, kind) do nothing;

  return new;
end $$;


ALTER FUNCTION "public"."record_solve_milestone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_fork_count"("p_source_table" "text", "p_source_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  if p_source_table = 'primers' then
    select count(*) into n from public.notebook_notes where fork_of = p_source_id;
    update public.primers set fork_count = n where id = p_source_id;
  elsif p_source_table = 'shared_resources' then
    select count(*) into n from public.notebook_notes where fork_of = p_source_id;
    update public.shared_resources set fork_count = n where id = p_source_id;
  else
    return 0;
  end if;
  return n;
end $$;


ALTER FUNCTION "public"."refresh_fork_count"("p_source_table" "text", "p_source_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_fork_counts_for_note"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_type text;
  target_id uuid;
begin
  target_type := coalesce(new.fork_of_type, old.fork_of_type);
  target_id := coalesce(new.fork_of, old.fork_of);
  if target_id is null then
    return coalesce(new, old);
  end if;

  if target_type = 'approach' then
    -- A specific approach rather than the whole author's total: the signal is
    -- "this approach was taken", not "this person has written things".
    update public.approaches
    set fork_count = (select count(*) from public.notebook_notes where fork_of = target_id)
    where id = target_id;
  elsif target_type = 'primer' then
    update public.primers
    set fork_count = (select count(*) from public.notebook_notes where fork_of = target_id)
    where id = target_id;
  elsif target_type = 'resource' then
    update public.shared_resources
    set fork_count = (select count(*) from public.notebook_notes where fork_of = target_id)
    where id = target_id;
  end if;

  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."refresh_fork_counts_for_note"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_note_fork_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.fork_of is not null then
    perform public.refresh_fork_count('primers', new.fork_of);
    perform public.refresh_fork_count('shared_resources', new.fork_of);
  end if;
  if tg_op = 'DELETE' and old.fork_of is not null then
    perform public.refresh_fork_count('primers', old.fork_of);
    perform public.refresh_fork_count('shared_resources', old.fork_of);
  end if;
  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."refresh_note_fork_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reply_rate_limit"() RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  select 20
$$;


ALTER FUNCTION "public"."reply_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_stuck_on_solve"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.stuck_requests
     set status = 'resolved'
   where user_id = new.user_id
     and problem_slug = new.problem_slug
     and status <> 'resolved'
     and battle_id = new.id;
  return new;
end $$;


ALTER FUNCTION "public"."resolve_stuck_on_solve"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stuck_reminder_allowed"("p_request_id" "uuid", "p_actor" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.stuck_requests r
    where r.id = p_request_id
      and r.user_id = p_actor
      and r.status = 'open'
      and (r.last_reminded_at is null or r.last_reminded_at < now() - interval '24 hours')
  );
$$;


ALTER FUNCTION "public"."stuck_reminder_allowed"("p_request_id" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suggestion_remind_allowed"("p_suggestion_id" "uuid", "p_actor" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.suggestions s
    where s.id = p_suggestion_id
      and (s.from_user = p_actor or s.to_user = p_actor)
      and (s.reminded_at is null or s.reminded_at < now() - interval '24 hours')
  );
$$;


ALTER FUNCTION "public"."suggestion_remind_allowed"("p_suggestion_id" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_review_queue_from_battle"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.outcome = 'failed' then
    insert into public.review_queue (user_id, problem_slug, reason)
    values (new.user_id, new.problem_slug, 'failed')
    on conflict (user_id, problem_slug, reason) where done_at is null do nothing;
  elsif new.outcome = 'solved' then
    update public.review_queue
       set done_at = now()
     where user_id = new.user_id
       and problem_slug = new.problem_slug
       and done_at is null;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."sync_review_queue_from_battle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_suggestion_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.message is null and new.note is not null then
      new.message := new.note;
    elsif new.note is null and new.message is not null then
      new.note := new.message;
    end if;
  else
    if new.message is distinct from old.message then
      new.note := new.message;
    elsif new.note is distinct from old.note then
      new.message := new.note;
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."sync_suggestion_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer DEFAULT 8) RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "approaches" integer, "primers" integer, "note_forks" integer, "primer_forks" integer, "challenge_completions" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id, p.username, p.avatar_url,
    coalesce(a.approaches, 0) as approaches,
    coalesce(pr.primers, 0) as primers,
    coalesce(f.note_forks, 0) as note_forks,
    coalesce(pf.primer_forks, 0) as primer_forks,
    coalesce(c.challenge_completions, 0) as challenge_completions
  from public.profiles p
  left join lateral (
    select count(*) as approaches
    from public.approaches a
    where a.user_id = p.id
      and a.visibility = 'public'
      and (a.pattern is not null and a.pattern ilike '%' || p_pattern || '%')
  ) a on true
  left join lateral (
    select count(*) as primers
    from public.primers pr2
    where pr2.author_id = p.id
      and pr2.visibility = 'public'
      and pr2.pattern ilike '%' || p_pattern || '%'
  ) pr on true
  left join lateral (
    -- Forks of this person's primers matching the pattern. Counted from the
    -- copies, not a counter column — see the note in teacher_stats.
    select count(*) as primer_forks
    from public.notebook_notes n
    join public.primers pr2 on pr2.id = n.fork_of
    where pr2.author_id = p.id
      and pr2.visibility = 'public'
      and pr2.pattern ilike '%' || p_pattern || '%'
  ) pf on true
  left join lateral (
    -- Public notes of this person, tagged with the pattern, that somebody
    -- forked. The fork's own visibility is not checked: a private copy is
    -- still a person deciding the note was worth taking.
    select count(*) as note_forks
    from public.notebook_notes n
    where n.owner_id = p.id
      and n.visibility = 'public'
      and exists (
        select 1 from public.notebook_notes c
        where c.fork_of = n.id
      )
      and p_pattern = any(n.pattern_tags)
  ) f on true
  left join lateral (
    select count(*) as challenge_completions
    from public.suggestions s
    where s.from_user = p.id and s.status = 'completed'
      and s.problem_title ilike '%' || p_pattern || '%'
  ) c on true
  where coalesce(a.approaches, 0) > 0
     or coalesce(pr.primers, 0) > 0
  order by (coalesce(f.note_forks, 0) + coalesce(pf.primer_forks, 0)) desc,
           coalesce(c.challenge_completions, 0) desc,
           p.username asc
  limit greatest(coalesce(p_limit, 8), 1)
$$;


ALTER FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer) IS '§21/§22 teacher discovery for a pattern. Ordered by forks and completed challenges — downstream use, not followers and not a collapsed score.';



CREATE OR REPLACE FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("gate" "text", "passed" boolean, "measured" "text", "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select * from public.gate_activation(p_squad_id)
  union all select * from public.gate_social(p_squad_id)
  union all select * from public.gate_learning(p_squad_id)
  union all select * from public.gate_retention(p_squad_id)
  union all select * from public.gate_organic(p_squad_id)
$$;


ALTER FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid") IS 'All §58 gates in one call. Omits the qualitative gate, which has no automated answer; the page carries it as unmeasurable.';



CREATE OR REPLACE FUNCTION "public"."validation_squads"() RETURNS TABLE("squad_id" "uuid", "name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select s.id, s.name
  from public.squads s
  where exists (select 1 from public.squad_members m where m.squad_id = s.id)
  order by s.name
$$;


ALTER FUNCTION "public"."validation_squads"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid",
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "requested_level" "text",
    "answered_level" "text",
    "outcome" "text" DEFAULT 'ok'::"text" NOT NULL,
    "refusal_reason" "text",
    "input_chars" integer,
    "output_chars" integer,
    "input_tokens" integer,
    "output_tokens" integer,
    "latency_ms" integer,
    "engine" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_calls_answered_level_check" CHECK ((("answered_level" IS NULL) OR ("answered_level" = ANY (ARRAY['nudge'::"text", 'pattern'::"text", 'direction'::"text", 'full'::"text"])))),
    CONSTRAINT "ai_calls_feature_check" CHECK (("feature" = ANY (ARRAY['stuck_assistant'::"text", 'explain_mistake'::"text", 'practice_next'::"text", 'explain_back'::"text", 'interview_sim'::"text"]))),
    CONSTRAINT "ai_calls_outcome_check" CHECK (("outcome" = ANY (ARRAY['ok'::"text", 'refused'::"text", 'rate_limited'::"text", 'disabled'::"text", 'no_provider'::"text", 'error'::"text"]))),
    CONSTRAINT "ai_calls_requested_level_check" CHECK ((("requested_level" IS NULL) OR ("requested_level" = ANY (ARRAY['nudge'::"text", 'pattern'::"text", 'direction'::"text", 'full'::"text"]))))
);


ALTER TABLE "public"."ai_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event" "text" NOT NULL,
    "props" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_events_event_check" CHECK (("event" ~ '^[a-z0-9_]{1,60}$'::"text"))
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "pattern" "text",
    "core_idea" "text" NOT NULL,
    "complexity_time" "text",
    "complexity_space" "text",
    "key_detail" "text",
    "edge_cases" "text",
    "mistakes" "text",
    "code" "text",
    "related_slugs" "text"[] DEFAULT '{}'::"text"[],
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "squad_id" "uuid",
    "fork_of" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fork_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "approaches_code_check" CHECK ((("code" IS NULL) OR ("octet_length"("code") <= 20000))),
    CONSTRAINT "approaches_core_idea_check" CHECK ((("char_length"("core_idea") >= 1) AND ("char_length"("core_idea") <= 5000))),
    CONSTRAINT "approaches_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "approaches_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'squad'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."approaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "squad_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_sec" integer,
    "outcome" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "self_reported" boolean DEFAULT true NOT NULL,
    "evidence" "text" DEFAULT 'none'::"text" NOT NULL,
    "scratchpad_md" "text",
    "confidence" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "challenge_id" "uuid",
    CONSTRAINT "battles_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= 1) AND ("confidence" <= 5)))),
    CONSTRAINT "battles_duration_sec_check" CHECK ((("duration_sec" IS NULL) OR ("duration_sec" >= 0))),
    CONSTRAINT "battles_evidence_check" CHECK (("evidence" = ANY (ARRAY['leetcode'::"text", 'none'::"text"]))),
    CONSTRAINT "battles_outcome_check" CHECK (("outcome" = ANY (ARRAY['in_progress'::"text", 'solved'::"text", 'failed'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "battles_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "battles_scratchpad_md_check" CHECK ((("scratchpad_md" IS NULL) OR ("octet_length"("scratchpad_md") <= 20000)))
);


ALTER TABLE "public"."battles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_sync_state" (
    "id" integer DEFAULT 1 NOT NULL,
    "last_synced_at" timestamp with time zone NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "catalog_sync_state_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."catalog_sync_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notebook_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "folder" "text",
    "pattern_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "problem_slug" "text",
    "title" "text" NOT NULL,
    "body_md" "text" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "squad_id" "uuid",
    "fork_of" "uuid",
    "fork_from" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fork_of_type" "text",
    CONSTRAINT "notebook_notes_body_md_check" CHECK (("octet_length"("body_md") <= 50000)),
    CONSTRAINT "notebook_notes_fork_of_type_check" CHECK ((("fork_of_type" IS NULL) OR ("fork_of_type" = ANY (ARRAY['approach'::"text", 'primer'::"text", 'resource'::"text"])))),
    CONSTRAINT "notebook_notes_problem_slug_check" CHECK ((("problem_slug" IS NULL) OR ("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text"))),
    CONSTRAINT "notebook_notes_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120))),
    CONSTRAINT "notebook_notes_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'squad'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."notebook_notes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notebook_notes"."fork_of_type" IS 'Which kind of object this note was copied from. Disambiguates the bare fork_of uuid, which can point at approaches, primers or shared_resources.';



CREATE TABLE IF NOT EXISTS "public"."primers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "pattern" "text" NOT NULL,
    "title" "text" NOT NULL,
    "recognize_when" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "mental_model" "text",
    "template_md" "text",
    "complexity" "text",
    "mistakes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "starter_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "author_id" "uuid",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "squad_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fork_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "primers_slug_check" CHECK (("slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "primers_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120))),
    CONSTRAINT "primers_visibility_check" CHECK (("visibility" = ANY (ARRAY['squad'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."primers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."problem_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "battle_id" "uuid",
    "duration_sec" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "problem_events_duration_sec_check" CHECK ((("duration_sec" IS NULL) OR ("duration_sec" >= 0))),
    CONSTRAINT "problem_events_kind_check" CHECK (("kind" = ANY (ARRAY['attempted'::"text", 'solved'::"text", 'explained'::"text", 'revisited'::"text", 'challenge_completed'::"text", 'failed'::"text", 'stuck'::"text"]))),
    CONSTRAINT "problem_events_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text"))
);


ALTER TABLE "public"."problem_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "leetcode_username" "text",
    "avatar_url" "text",
    "contest_rating" double precision DEFAULT 1500,
    "global_rank" integer,
    "streak" integer DEFAULT 0,
    "total_easy" integer DEFAULT 0,
    "total_medium" integer DEFAULT 0,
    "total_hard" integer DEFAULT 0,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "leetcode_session_encrypted" "text",
    "leetcode_session_synced_at" timestamp with time zone,
    "contest_attended" integer DEFAULT 0,
    "contest_global_rank" integer,
    "contest_top_percentage" double precision,
    "active_squad_id" "uuid",
    "objective" "text",
    "is_product_admin" boolean DEFAULT false NOT NULL,
    "invited_by" "uuid",
    "joined_via_referral" "uuid",
    CONSTRAINT "profiles_objective_check" CHECK ((("objective" IS NULL) OR ("objective" = ANY (ARRAY['internship'::"text", 'fulltime'::"text", 'consistency'::"text"])))),
    CONSTRAINT "profiles_stats_nonnegative" CHECK (((COALESCE("contest_rating", (0)::double precision) >= (0)::double precision) AND (COALESCE("streak", 0) >= 0) AND (COALESCE("total_easy", 0) >= 0) AND (COALESCE("total_medium", 0) >= 0) AND (COALESCE("total_hard", 0) >= 0) AND (COALESCE("contest_attended", 0) >= 0)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."invited_by" IS 'The person whose link brought this account here. Set once, first referrer wins, so referral credit cannot be overwritten or farmed.';



COMMENT ON COLUMN "public"."profiles"."joined_via_referral" IS 'The referral link used. joined_via_squad is derivable from it; kept so the join can be traced without joining the referrals table.';



CREATE OR REPLACE VIEW "public"."content_impact" AS
 WITH "fork_events" AS (
         SELECT "n"."id" AS "fork_id",
            "n"."owner_id" AS "forker_id",
            "n"."fork_of" AS "source_id",
            "n"."fork_of_type" AS "source_type",
            "n"."created_at" AS "forked_at"
           FROM "public"."notebook_notes" "n"
          WHERE ("n"."fork_of" IS NOT NULL)
        ), "completion_windows" AS (
         SELECT "f"."fork_id",
            "f"."forker_id",
            "f"."source_id",
            "f"."source_type",
            "f"."forked_at",
            "p_1"."slug" AS "problem_slug"
           FROM (("fork_events" "f"
             LEFT JOIN "public"."primers" "pr" ON ((("pr"."id" = "f"."source_id") AND ("f"."source_type" = 'primer'::"text"))))
             CROSS JOIN LATERAL "unnest"(COALESCE("pr"."starter_slugs", '{}'::"text"[])) "p_1"("slug"))
        UNION ALL
         SELECT "f"."fork_id",
            "f"."forker_id",
            "f"."source_id",
            "f"."source_type",
            "f"."forked_at",
            "a"."problem_slug"
           FROM ("fork_events" "f"
             JOIN "public"."approaches" "a" ON ((("a"."id" = "f"."source_id") AND ("f"."source_type" = 'approach'::"text"))))
        )
 SELECT "c"."source_id",
    "c"."source_type",
    "c"."forker_id",
    "p"."username" AS "forker_username",
    "c"."problem_slug",
    "c"."forked_at",
    ( SELECT "min"("e"."created_at") AS "min"
           FROM "public"."problem_events" "e"
          WHERE (("e"."user_id" = "c"."forker_id") AND ("e"."problem_slug" = "c"."problem_slug") AND ("e"."kind" = ANY (ARRAY['solved'::"text", 'revisited'::"text"])) AND ("e"."created_at" >= "c"."forked_at") AND ("e"."created_at" <= ("c"."forked_at" + '30 days'::interval)))) AS "solved_at"
   FROM ("completion_windows" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "c"."forker_id")))
  WHERE ("c"."problem_slug" IS NOT NULL);


ALTER VIEW "public"."content_impact" OWNER TO "postgres";


COMMENT ON VIEW "public"."content_impact" IS '§56 Loop C: one row per (fork, target problem). solved_at is null unless the forker solved that problem within 30 days of copying, so the attribution is a bounded claim rather than a permanent one.';



CREATE TABLE IF NOT EXISTS "public"."contests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "url" "text",
    "platform" "text" DEFAULT 'leetcode'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contests_platform_check" CHECK (("platform" = ANY (ARRAY['leetcode'::"text", 'codeforces'::"text", 'other'::"text"]))),
    CONSTRAINT "contests_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120))),
    CONSTRAINT "contests_url_check" CHECK ((("url" IS NULL) OR ("url" ~ '^https?://'::"text")))
);


ALTER TABLE "public"."contests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "emoji" "text" DEFAULT '📁'::"text",
    "description" "text",
    "is_curated" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_battles" (
    "user_id" "uuid" NOT NULL,
    "battle_date" "date" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "reason_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_battles_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text"))
);


ALTER TABLE "public"."daily_battles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussion_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body_md" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "discussion_replies_body_md_check" CHECK ((("char_length"(TRIM(BOTH FROM "body_md")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body_md")) <= 2000)))
);


ALTER TABLE "public"."discussion_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "pattern_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "body_md" "text" NOT NULL,
    "squad_id" "uuid",
    "visibility" "text" DEFAULT 'squad'::"text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "discussions_body_md_check" CHECK ((("char_length"(TRIM(BOTH FROM "body_md")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body_md")) <= 4000))),
    CONSTRAINT "discussions_pattern_linked" CHECK (("cardinality"("pattern_tags") >= 1)),
    CONSTRAINT "discussions_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "discussions_visibility_check" CHECK (("visibility" = ANY (ARRAY['squad'::"text", 'global'::"text"])))
);


ALTER TABLE "public"."discussions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_triage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature" "text" NOT NULL,
    "label" "text",
    "problem" "text",
    "target_user" "text",
    "behaviour" "text",
    "core_loop_link" "text",
    "alternative" "text",
    "cost" "text",
    "risk" "text",
    "success_metric" "text",
    "decision" "text",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feature_triage_feature_check" CHECK ((("char_length"(TRIM(BOTH FROM "feature")) >= 1) AND ("char_length"(TRIM(BOTH FROM "feature")) <= 120))),
    CONSTRAINT "feature_triage_label_check" CHECK ((("label" IS NULL) OR ("label" = ANY (ARRAY['CORE'::"text", 'SUPPORT'::"text", 'EXPERIMENT'::"text", 'FUTURE'::"text", 'KILL'::"text", 'DUPLICATE'::"text"]))))
);


ALTER TABLE "public"."feature_triage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "discussion_id" "uuid",
    "reason" "text" NOT NULL,
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feed_reports_detail_check" CHECK ((("detail" IS NULL) OR ("octet_length"("detail") <= 1000))),
    CONSTRAINT "feed_reports_has_target" CHECK ((("event_id" IS NOT NULL) OR ("discussion_id" IS NOT NULL))),
    CONSTRAINT "feed_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'noise'::"text", 'copied'::"text", 'bait'::"text", 'abuse'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."feed_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "followed_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "follows_not_self" CHECK (("follower_id" <> "followed_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_problems" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "title_slug" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "category" "text" NOT NULL,
    "order_index" integer DEFAULT 0,
    CONSTRAINT "list_problems_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))
);


ALTER TABLE "public"."list_problems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "shared_with" "uuid" NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."note_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "deep_link" "text",
    "actor_id" "uuid",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dedupe_key" "text",
    CONSTRAINT "notifications_body_check" CHECK ((("body" IS NULL) OR ("char_length"("body") <= 500))),
    CONSTRAINT "notifications_deep_link_check" CHECK ((("deep_link" IS NULL) OR ("deep_link" ~ '^/[A-Za-z0-9/_?=&%-]*$'::"text"))),
    CONSTRAINT "notifications_kind_check" CHECK (("kind" = ANY (ARRAY['challenge'::"text", 'challenge_completed'::"text", 'goal'::"text", 'revenge'::"text", 'recap'::"text", 'contest'::"text"]))),
    CONSTRAINT "notifications_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 140)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body_md" "text" NOT NULL,
    "href" "text",
    "pinned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_posts_body_md_check" CHECK ((("char_length"(TRIM(BOTH FROM "body_md")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body_md")) <= 4000))),
    CONSTRAINT "platform_posts_href_check" CHECK ((("href" IS NULL) OR ("href" ~ '^https?://'::"text"))),
    CONSTRAINT "platform_posts_kind_check" CHECK (("kind" = ANY (ARRAY['contest'::"text", 'product'::"text", 'maintenance'::"text"]))),
    CONSTRAINT "platform_posts_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."platform_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."problems" (
    "title_slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "paid_only" boolean DEFAULT false,
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "problems_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))
);


ALTER TABLE "public"."problems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "problem_title" "text",
    "difficulty" "text",
    "pattern" "text",
    "why_json" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "decision" "text" DEFAULT 'shown'::"text" NOT NULL,
    "surface" "text",
    "engine_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "signal_ids" "text"[],
    CONSTRAINT "recommendation_log_decision_check" CHECK (("decision" = ANY (ARRAY['shown'::"text", 'accepted'::"text", 'rejected'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "recommendation_log_difficulty_check" CHECK ((("difficulty" IS NULL) OR ("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))),
    CONSTRAINT "recommendation_log_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "recommendation_log_surface_check" CHECK ((("surface" IS NULL) OR ("surface" = ANY (ARRAY['home'::"text", 'practice_hub'::"text", 'problem'::"text"]))))
);


ALTER TABLE "public"."recommendation_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recommendation_log"."signal_ids" IS '§24: the RecommendationSignal ids behind this suggestion, so accept rate can be attributed per signal. Why_json holds the same reasons as prose for human debugging.';



CREATE TABLE IF NOT EXISTS "public"."review_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "due_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "done_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_queue_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "review_queue_reason_check" CHECK (("reason" = ANY (ARRAY['failed'::"text", 'gap'::"text", 'weak_pattern'::"text", 'bookmark'::"text", 'low_confidence'::"text"])))
);


ALTER TABLE "public"."review_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "content" "text" NOT NULL,
    "external_url" "text",
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "squad_id" "uuid",
    "fork_of" "uuid",
    "fork_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "shared_resources_category_check" CHECK (("category" = ANY (ARRAY['Template'::"text", 'Interview Log'::"text", 'Cheat Sheet'::"text", 'Article'::"text"]))),
    CONSTRAINT "shared_resources_visibility_check" CHECK (("visibility" = ANY (ARRAY['squad'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."shared_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "target_count" integer NOT NULL,
    "pattern" "text",
    "deadline" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "starts_at" "date" DEFAULT CURRENT_DATE,
    "archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "squad_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text"]))),
    CONSTRAINT "squad_goals_target_count_check" CHECK ((("target_count" >= 1) AND ("target_count" <= 10000))),
    CONSTRAINT "squad_goals_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."squad_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_members" (
    "squad_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "squad_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."squad_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "detail" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "squad_milestones_detail_check" CHECK ((("detail" IS NULL) OR ("char_length"("detail") <= 300))),
    CONSTRAINT "squad_milestones_kind_check" CHECK (("kind" = ANY (ARRAY['first_member'::"text", 'first_challenge'::"text", 'first_solve'::"text", 'milestone_solves'::"text", 'milestone_solves_100'::"text", 'milestone_challenges'::"text", 'season_complete'::"text", 'goal_complete'::"text"]))),
    CONSTRAINT "squad_milestones_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."squad_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_recaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "body_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "squad_recaps_window_check" CHECK (("week_end" >= "week_start"))
);


ALTER TABLE "public"."squad_recaps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid" NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "opens" integer DEFAULT 0 NOT NULL,
    "joins" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "squad_referrals_token_check" CHECK (("token" ~ '^[A-Za-z0-9]{12,24}$'::"text"))
);


ALTER TABLE "public"."squad_referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squad_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "objective" "text",
    "starts_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ends_at" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "squad_seasons_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80))),
    CONSTRAINT "squad_seasons_objective_check" CHECK ((("objective" IS NULL) OR ("char_length"("objective") <= 500))),
    CONSTRAINT "squad_seasons_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'active'::"text", 'complete'::"text"]))),
    CONSTRAINT "squad_seasons_window_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" >= "starts_at")))
);


ALTER TABLE "public"."squad_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."squads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "description" "text",
    "created_by" "uuid",
    "invite_code" "text" NOT NULL,
    "shared_goal_text" "text",
    "season_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ai_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "squads_description_check" CHECK ((("description" IS NULL) OR ("octet_length"("description") <= 2000))),
    CONSTRAINT "squads_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60)))
);


ALTER TABLE "public"."squads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."squads"."ai_enabled" IS '§45: AI features are a per-squad experiment, off by default. Set by the platform, never by a member.';



CREATE TABLE IF NOT EXISTS "public"."stuck_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "level" "text" NOT NULL,
    "body_md" "text" NOT NULL,
    "accepted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stuck_replies_body_md_check" CHECK ((("char_length"("body_md") >= 1) AND ("char_length"("body_md") <= 4000))),
    CONSTRAINT "stuck_replies_level_check" CHECK (("level" = ANY (ARRAY['nudge'::"text", 'pattern'::"text", 'direction'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."stuck_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stuck_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "battle_id" "uuid",
    "level" "text" DEFAULT 'nudge'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'squad'::"text" NOT NULL,
    "squad_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "last_reminded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stuck_requests_level_check" CHECK (("level" = ANY (ARRAY['nudge'::"text", 'pattern'::"text", 'direction'::"text", 'full'::"text"]))),
    CONSTRAINT "stuck_requests_problem_slug_check" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")),
    CONSTRAINT "stuck_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'helped'::"text", 'resolved'::"text"]))),
    CONSTRAINT "stuck_requests_visibility_check" CHECK (("visibility" = ANY (ARRAY['squad'::"text", 'public'::"text", 'anon'::"text"])))
);


ALTER TABLE "public"."stuck_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_user" "uuid" NOT NULL,
    "to_user" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "problem_title" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "sender_time_sec" integer,
    "beat_time" boolean DEFAULT false NOT NULL,
    "deadline_at" timestamp with time zone,
    "parent_id" "uuid",
    "spoiler" boolean DEFAULT false NOT NULL,
    "message" "text",
    "accepted_at" timestamp with time zone,
    "reminded_at" timestamp with time zone,
    CONSTRAINT "suggestions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"]))),
    CONSTRAINT "suggestions_sender_time_sec_check" CHECK ((("sender_time_sec" IS NULL) OR ("sender_time_sec" >= 0))),
    CONSTRAINT "suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "last_sync_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sync_rate_limits" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."teacher_stats" AS
 WITH "solve_counts" AS (
         SELECT "e"."user_id",
            "count"(*) FILTER (WHERE ("e"."kind" = ANY (ARRAY['solved'::"text", 'revisited'::"text"]))) AS "logged_solves",
            "count"(*) FILTER (WHERE (("e"."kind" = ANY (ARRAY['solved'::"text", 'revisited'::"text"])) AND (COALESCE(("e"."metadata" ->> 'source'::"text"), ''::"text") = 'leetcode'::"text"))) AS "verified_solves",
            "count"(DISTINCT "date_trunc"('day'::"text", "e"."created_at")) AS "active_days"
           FROM "public"."problem_events" "e"
          GROUP BY "e"."user_id"
        ), "sessions" AS (
         SELECT "battles"."user_id",
            "count"(*) AS "battles",
            "count"(*) FILTER (WHERE ("battles"."outcome" = 'solved'::"text")) AS "battles_won"
           FROM "public"."battles"
          GROUP BY "battles"."user_id"
        ), "teaching" AS (
         SELECT "approaches"."user_id",
            "count"(*) AS "approaches",
            "count"(DISTINCT "approaches"."pattern") AS "patterns_taught"
           FROM "public"."approaches"
          WHERE ("approaches"."visibility" = 'public'::"text")
          GROUP BY "approaches"."user_id"
        ), "primer_counts" AS (
         SELECT "p_1"."author_id" AS "user_id",
            "count"(*) AS "primers"
           FROM "public"."primers" "p_1"
          WHERE (("p_1"."visibility" = 'public'::"text") AND ("p_1"."author_id" IS NOT NULL))
          GROUP BY "p_1"."author_id"
        ), "primer_forks" AS (
         SELECT "pr_1"."author_id" AS "user_id",
            "count"(*) AS "primer_forks"
           FROM ("public"."notebook_notes" "n"
             JOIN "public"."primers" "pr_1" ON (("pr_1"."id" = "n"."fork_of")))
          WHERE ("pr_1"."author_id" IS NOT NULL)
          GROUP BY "pr_1"."author_id"
        ), "challenges" AS (
         SELECT "suggestions"."from_user" AS "user_id",
            "count"(*) FILTER (WHERE ("suggestions"."status" = 'completed'::"text")) AS "challenge_completions",
            "count"(*) AS "challenges_sent"
           FROM "public"."suggestions"
          GROUP BY "suggestions"."from_user"
        ), "help_discussions" AS (
         SELECT "d"."author_id" AS "user_id",
            "count"(*) AS "discussions",
            COALESCE("sum"("r"."n"), (0)::numeric) AS "replies_received"
           FROM ("public"."discussions" "d"
             LEFT JOIN LATERAL ( SELECT "count"(*) AS "n"
                   FROM "public"."discussion_replies" "r_1"
                  WHERE (("r_1"."discussion_id" = "d"."id") AND ("r_1"."deleted_at" IS NULL))) "r" ON (true))
          WHERE ("d"."deleted_at" IS NULL)
          GROUP BY "d"."author_id"
        ), "impact" AS (
         SELECT "n"."owner_id" AS "user_id",
            "count"(*) AS "note_forks"
           FROM "public"."notebook_notes" "n"
          WHERE (("n"."fork_of" IS NOT NULL) AND ("n"."visibility" = 'public'::"text") AND (EXISTS ( SELECT 1
                   FROM "public"."notebook_notes" "o"
                  WHERE ("o"."id" = "n"."fork_of"))))
          GROUP BY "n"."owner_id"
        ), "pattern_list" AS (
         SELECT "s_1"."user_id",
            "array_agg"(DISTINCT "s_1"."p") AS "frequent_patterns"
           FROM ( SELECT "approaches"."user_id",
                    "approaches"."pattern" AS "p"
                   FROM "public"."approaches"
                  WHERE (("approaches"."visibility" = 'public'::"text") AND ("approaches"."pattern" IS NOT NULL))
                UNION
                 SELECT "dd"."author_id" AS "user_id",
                    "unnest"("dd"."pattern_tags") AS "p"
                   FROM "public"."discussions" "dd"
                  WHERE ("dd"."deleted_at" IS NULL)
                UNION
                 SELECT "primers"."author_id",
                    "primers"."pattern"
                   FROM "public"."primers"
                  WHERE ("primers"."visibility" = 'public'::"text")) "s_1"
          WHERE (("s_1"."p" IS NOT NULL) AND ("s_1"."p" <> ''::"text"))
          GROUP BY "s_1"."user_id"
        )
 SELECT "p"."id" AS "user_id",
    "p"."username",
    COALESCE("s"."logged_solves", (0)::bigint) AS "logged_solves",
    COALESCE("s"."verified_solves", (0)::bigint) AS "verified_solves",
    COALESCE("s"."active_days", (0)::bigint) AS "active_days",
    COALESCE("ss"."battles", (0)::bigint) AS "battles",
    COALESCE("ss"."battles_won", (0)::bigint) AS "battles_won",
    COALESCE("t"."approaches", (0)::bigint) AS "approaches",
    COALESCE("t"."patterns_taught", (0)::bigint) AS "patterns_taught",
    COALESCE("pr"."primers", (0)::bigint) AS "primers",
    COALESCE("ch"."challenge_completions", (0)::bigint) AS "challenge_completions",
    COALESCE("ch"."challenges_sent", (0)::bigint) AS "challenges_sent",
    COALESCE("hd"."discussions", (0)::bigint) AS "discussions",
    COALESCE("hd"."replies_received", (0)::numeric) AS "replies_received",
    COALESCE("i"."note_forks", (0)::bigint) AS "note_forks",
    COALESCE("pf"."primer_forks", (0)::bigint) AS "primer_forks",
    COALESCE("pl"."frequent_patterns", '{}'::"text"[]) AS "frequent_patterns",
    COALESCE("imp"."improvements", (0)::bigint) AS "improvements"
   FROM (((((((((("public"."profiles" "p"
     LEFT JOIN "solve_counts" "s" ON (("s"."user_id" = "p"."id")))
     LEFT JOIN "sessions" "ss" ON (("ss"."user_id" = "p"."id")))
     LEFT JOIN "teaching" "t" ON (("t"."user_id" = "p"."id")))
     LEFT JOIN "primer_counts" "pr" ON (("pr"."user_id" = "p"."id")))
     LEFT JOIN "primer_forks" "pf" ON (("pf"."user_id" = "p"."id")))
     LEFT JOIN "challenges" "ch" ON (("ch"."user_id" = "p"."id")))
     LEFT JOIN "help_discussions" "hd" ON (("hd"."user_id" = "p"."id")))
     LEFT JOIN "impact" "i" ON (("i"."user_id" = "p"."id")))
     LEFT JOIN "pattern_list" "pl" ON (("pl"."user_id" = "p"."id")))
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "improvements"
           FROM ( SELECT "e"."problem_slug"
                   FROM "public"."problem_events" "e"
                  WHERE (("e"."user_id" = "p"."id") AND ("e"."kind" = ANY (ARRAY['solved'::"text", 'revisited'::"text"])) AND ("e"."duration_sec" IS NOT NULL))
                  GROUP BY "e"."problem_slug"
                 HAVING ("count"(*) >= 2)) "x") "imp" ON (true));


ALTER VIEW "public"."teacher_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."teacher_stats" IS '§22 reputation as five dimensions with no total. Verified solves / Teaching / Helpfulness / Consistency / Impact. There is deliberately no aggregate column and no rank — a single score creates false precision and invites gaming.';



CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_blocks_not_self" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_problem_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "status" "text" DEFAULT 'solved'::"text",
    "notes" "text",
    "solved_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_problem_status_status_check" CHECK (("status" = ANY (ARRAY['solved'::"text", 'attempted'::"text"])))
);


ALTER TABLE "public"."user_problem_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."validation_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "squad_id" "uuid",
    "day_number" integer,
    "category" "text" NOT NULL,
    "observation" "text" NOT NULL,
    "observed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "validation_observations_category_check" CHECK (("category" = ANY (ARRAY['hesitation'::"text", 'ignored'::"text", 'requested'::"text", 'workaround'::"text", 'praise'::"text", 'blocker'::"text"]))),
    CONSTRAINT "validation_observations_day_number_check" CHECK ((("day_number" IS NULL) OR (("day_number" >= 1) AND ("day_number" <= 14)))),
    CONSTRAINT "validation_observations_observation_check" CHECK ((("char_length"(TRIM(BOTH FROM "observation")) >= 1) AND ("char_length"(TRIM(BOTH FROM "observation")) <= 2000)))
);


ALTER TABLE "public"."validation_observations" OWNER TO "postgres";


DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_calls_pkey' AND conrelid = '"public"."ai_calls"'::regclass) THEN
    ALTER TABLE "public"."ai_calls"
    ADD CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'analytics_events_pkey' AND conrelid = '"public"."analytics_events"'::regclass) THEN
    ALTER TABLE "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'approaches_pkey' AND conrelid = '"public"."approaches"'::regclass) THEN
    ALTER TABLE "public"."approaches"
    ADD CONSTRAINT "approaches_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'battles_pkey' AND conrelid = '"public"."battles"'::regclass) THEN
    ALTER TABLE "public"."battles"
    ADD CONSTRAINT "battles_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'catalog_sync_state_pkey' AND conrelid = '"public"."catalog_sync_state"'::regclass) THEN
    ALTER TABLE "public"."catalog_sync_state"
    ADD CONSTRAINT "catalog_sync_state_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'contests_pkey' AND conrelid = '"public"."contests"'::regclass) THEN
    ALTER TABLE "public"."contests"
    ADD CONSTRAINT "contests_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'contests_starts_at_platform_key' AND conrelid = '"public"."contests"'::regclass) THEN
    ALTER TABLE "public"."contests"
    ADD CONSTRAINT "contests_starts_at_platform_key" UNIQUE ("starts_at", "platform");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'custom_lists_pkey' AND conrelid = '"public"."custom_lists"'::regclass) THEN
    ALTER TABLE "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'custom_lists_slug_format' AND conrelid = '"public"."custom_lists"'::regclass) THEN
    ALTER TABLE "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_slug_format" CHECK (("slug" ~ '^[a-z0-9-]{1,80}$'::"text")) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'custom_lists_slug_key' AND conrelid = '"public"."custom_lists"'::regclass) THEN
    ALTER TABLE "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_slug_key" UNIQUE ("slug");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'daily_battles_pkey' AND conrelid = '"public"."daily_battles"'::regclass) THEN
    ALTER TABLE "public"."daily_battles"
    ADD CONSTRAINT "daily_battles_pkey" PRIMARY KEY ("user_id", "battle_date");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussion_replies_pkey' AND conrelid = '"public"."discussion_replies"'::regclass) THEN
    ALTER TABLE "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussions_pkey' AND conrelid = '"public"."discussions"'::regclass) THEN
    ALTER TABLE "public"."discussions"
    ADD CONSTRAINT "discussions_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feature_triage_pkey' AND conrelid = '"public"."feature_triage"'::regclass) THEN
    ALTER TABLE "public"."feature_triage"
    ADD CONSTRAINT "feature_triage_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_events_pkey' AND conrelid = '"public"."feed_events"'::regclass) THEN
    ALTER TABLE "public"."feed_events"
    ADD CONSTRAINT "feed_events_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_reports_pkey' AND conrelid = '"public"."feed_reports"'::regclass) THEN
    ALTER TABLE "public"."feed_reports"
    ADD CONSTRAINT "feed_reports_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'follows_pkey' AND conrelid = '"public"."follows"'::regclass) THEN
    ALTER TABLE "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "followed_id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'list_problems_pkey' AND conrelid = '"public"."list_problems"'::regclass) THEN
    ALTER TABLE "public"."list_problems"
    ADD CONSTRAINT "list_problems_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'list_problems_slug_format' AND conrelid = '"public"."list_problems"'::regclass) THEN
    ALTER TABLE "public"."list_problems"
    ADD CONSTRAINT "list_problems_slug_format" CHECK (("title_slug" ~ '^[a-z0-9-]{1,80}$'::"text")) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'note_shares_note_id_shared_with_key' AND conrelid = '"public"."note_shares"'::regclass) THEN
    ALTER TABLE "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_shared_with_key" UNIQUE ("note_id", "shared_with");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'note_shares_pkey' AND conrelid = '"public"."note_shares"'::regclass) THEN
    ALTER TABLE "public"."note_shares"
    ADD CONSTRAINT "note_shares_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notebook_notes_pkey' AND conrelid = '"public"."notebook_notes"'::regclass) THEN
    ALTER TABLE "public"."notebook_notes"
    ADD CONSTRAINT "notebook_notes_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notifications_pkey' AND conrelid = '"public"."notifications"'::regclass) THEN
    ALTER TABLE "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'platform_posts_pkey' AND conrelid = '"public"."platform_posts"'::regclass) THEN
    ALTER TABLE "public"."platform_posts"
    ADD CONSTRAINT "platform_posts_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'primers_pkey' AND conrelid = '"public"."primers"'::regclass) THEN
    ALTER TABLE "public"."primers"
    ADD CONSTRAINT "primers_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'primers_slug_key' AND conrelid = '"public"."primers"'::regclass) THEN
    ALTER TABLE "public"."primers"
    ADD CONSTRAINT "primers_slug_key" UNIQUE ("slug");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'problem_events_pkey' AND conrelid = '"public"."problem_events"'::regclass) THEN
    ALTER TABLE "public"."problem_events"
    ADD CONSTRAINT "problem_events_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'problems_pkey' AND conrelid = '"public"."problems"'::regclass) THEN
    ALTER TABLE "public"."problems"
    ADD CONSTRAINT "problems_pkey" PRIMARY KEY ("title_slug");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_handle_len' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_handle_len" CHECK ((("leetcode_username" IS NULL) OR (("char_length"("leetcode_username") >= 1) AND ("char_length"("leetcode_username") <= 50)))) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_leetcode_username_key' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_leetcode_username_key" UNIQUE ("leetcode_username");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_pkey' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_rank_nonnegative' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_rank_nonnegative" CHECK (((COALESCE("global_rank", 0) >= 0) AND (COALESCE("contest_global_rank", 0) >= 0) AND (COALESCE("contest_top_percentage", (0)::double precision) >= (0)::double precision) AND (COALESCE("contest_top_percentage", (0)::double precision) <= (100)::double precision))) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_username_key' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_username_len' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_username_len" CHECK ((("char_length"("username") >= 1) AND ("char_length"("username") <= 50))) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'push_subscriptions_endpoint_key' AND conrelid = '"public"."push_subscriptions"'::regclass) THEN
    ALTER TABLE "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'push_subscriptions_pkey' AND conrelid = '"public"."push_subscriptions"'::regclass) THEN
    ALTER TABLE "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'recommendation_log_pkey' AND conrelid = '"public"."recommendation_log"'::regclass) THEN
    ALTER TABLE "public"."recommendation_log"
    ADD CONSTRAINT "recommendation_log_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'review_queue_pkey' AND conrelid = '"public"."review_queue"'::regclass) THEN
    ALTER TABLE "public"."review_queue"
    ADD CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'shared_resources_pkey' AND conrelid = '"public"."shared_resources"'::regclass) THEN
    ALTER TABLE "public"."shared_resources"
    ADD CONSTRAINT "shared_resources_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_goals_pkey' AND conrelid = '"public"."squad_goals"'::regclass) THEN
    ALTER TABLE "public"."squad_goals"
    ADD CONSTRAINT "squad_goals_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_members_pkey' AND conrelid = '"public"."squad_members"'::regclass) THEN
    ALTER TABLE "public"."squad_members"
    ADD CONSTRAINT "squad_members_pkey" PRIMARY KEY ("squad_id", "user_id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_milestones_pkey' AND conrelid = '"public"."squad_milestones"'::regclass) THEN
    ALTER TABLE "public"."squad_milestones"
    ADD CONSTRAINT "squad_milestones_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_recaps_pkey' AND conrelid = '"public"."squad_recaps"'::regclass) THEN
    ALTER TABLE "public"."squad_recaps"
    ADD CONSTRAINT "squad_recaps_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_referrals_pkey' AND conrelid = '"public"."squad_referrals"'::regclass) THEN
    ALTER TABLE "public"."squad_referrals"
    ADD CONSTRAINT "squad_referrals_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_referrals_squad_id_referrer_id_key' AND conrelid = '"public"."squad_referrals"'::regclass) THEN
    ALTER TABLE "public"."squad_referrals"
    ADD CONSTRAINT "squad_referrals_squad_id_referrer_id_key" UNIQUE ("squad_id", "referrer_id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_referrals_token_key' AND conrelid = '"public"."squad_referrals"'::regclass) THEN
    ALTER TABLE "public"."squad_referrals"
    ADD CONSTRAINT "squad_referrals_token_key" UNIQUE ("token");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_seasons_pkey' AND conrelid = '"public"."squad_seasons"'::regclass) THEN
    ALTER TABLE "public"."squad_seasons"
    ADD CONSTRAINT "squad_seasons_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squads_invite_code_key' AND conrelid = '"public"."squads"'::regclass) THEN
    ALTER TABLE "public"."squads"
    ADD CONSTRAINT "squads_invite_code_key" UNIQUE ("invite_code");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squads_pkey' AND conrelid = '"public"."squads"'::regclass) THEN
    ALTER TABLE "public"."squads"
    ADD CONSTRAINT "squads_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_replies_pkey' AND conrelid = '"public"."stuck_replies"'::regclass) THEN
    ALTER TABLE "public"."stuck_replies"
    ADD CONSTRAINT "stuck_replies_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_requests_pkey' AND conrelid = '"public"."stuck_requests"'::regclass) THEN
    ALTER TABLE "public"."stuck_requests"
    ADD CONSTRAINT "stuck_requests_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_note_cap' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_note_cap" CHECK ((("note" IS NULL) OR ("octet_length"("note") <= 2000))) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_pkey' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_slug_format' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_slug_format" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'sync_rate_limits_pkey' AND conrelid = '"public"."sync_rate_limits"'::regclass) THEN
    ALTER TABLE "public"."sync_rate_limits"
    ADD CONSTRAINT "sync_rate_limits_pkey" PRIMARY KEY ("user_id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_blocks_pkey' AND conrelid = '"public"."user_blocks"'::regclass) THEN
    ALTER TABLE "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_problem_status_notes_cap' AND conrelid = '"public"."user_problem_status"'::regclass) THEN
    ALTER TABLE "public"."user_problem_status"
    ADD CONSTRAINT "user_problem_status_notes_cap" CHECK ((("notes" IS NULL) OR ("octet_length"("notes") <= 5000))) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_problem_status_pkey' AND conrelid = '"public"."user_problem_status"'::regclass) THEN
    ALTER TABLE "public"."user_problem_status"
    ADD CONSTRAINT "user_problem_status_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_problem_status_slug_format' AND conrelid = '"public"."user_problem_status"'::regclass) THEN
    ALTER TABLE "public"."user_problem_status"
    ADD CONSTRAINT "user_problem_status_slug_format" CHECK (("problem_slug" ~ '^[a-z0-9-]{1,80}$'::"text")) NOT VALID;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_problem_status_user_id_problem_slug_key' AND conrelid = '"public"."user_problem_status"'::regclass) THEN
    ALTER TABLE "public"."user_problem_status"
    ADD CONSTRAINT "user_problem_status_user_id_problem_slug_key" UNIQUE ("user_id", "problem_slug");
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'validation_observations_pkey' AND conrelid = '"public"."validation_observations"'::regclass) THEN
    ALTER TABLE "public"."validation_observations"
    ADD CONSTRAINT "validation_observations_pkey" PRIMARY KEY ("id");
  END IF;
END
$guard$;



CREATE INDEX IF NOT EXISTS "ai_calls_feature_idx" ON "public"."ai_calls" USING "btree" ("feature", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "ai_calls_squad_idx" ON "public"."ai_calls" USING "btree" ("squad_id", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "analytics_events_event_time_idx" ON "public"."analytics_events" USING "btree" ("event", "occurred_at" DESC);



CREATE INDEX IF NOT EXISTS "analytics_events_user_idx" ON "public"."analytics_events" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX IF NOT EXISTS "approaches_slug_idx" ON "public"."approaches" USING "btree" ("problem_slug", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "approaches_user_idx" ON "public"."approaches" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "battles_challenge_idx" ON "public"."battles" USING "btree" ("challenge_id") WHERE ("challenge_id" IS NOT NULL);



CREATE UNIQUE INDEX IF NOT EXISTS "battles_one_live_per_user" ON "public"."battles" USING "btree" ("user_id") WHERE ("outcome" = 'in_progress'::"text");



CREATE INDEX IF NOT EXISTS "battles_user_slug_idx" ON "public"."battles" USING "btree" ("user_id", "problem_slug", "started_at" DESC);



CREATE INDEX IF NOT EXISTS "contests_upcoming_idx" ON "public"."contests" USING "btree" ("starts_at");



CREATE INDEX IF NOT EXISTS "custom_lists_created_by_idx" ON "public"."custom_lists" USING "btree" ("created_by");



CREATE INDEX IF NOT EXISTS "discussion_replies_discussion_idx" ON "public"."discussion_replies" USING "btree" ("discussion_id", "created_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX IF NOT EXISTS "discussions_author_idx" ON "public"."discussions" USING "btree" ("author_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX IF NOT EXISTS "discussions_problem_idx" ON "public"."discussions" USING "btree" ("problem_slug", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "feature_triage_label_idx" ON "public"."feature_triage" USING "btree" ("label");



CREATE UNIQUE INDEX IF NOT EXISTS "feature_triage_name_unique" ON "public"."feature_triage" USING "btree" ("lower"("feature"));



CREATE INDEX IF NOT EXISTS "feed_events_recent_idx" ON "public"."feed_events" USING "btree" ("created_at" DESC);



CREATE INDEX IF NOT EXISTS "feed_events_squad_idx" ON "public"."feed_events" USING "btree" ("squad_id", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "feed_events_user_id_idx" ON "public"."feed_events" USING "btree" ("user_id");



CREATE UNIQUE INDEX IF NOT EXISTS "feed_reports_discussion_unique" ON "public"."feed_reports" USING "btree" ("reporter_id", "discussion_id") WHERE ("discussion_id" IS NOT NULL);



CREATE INDEX IF NOT EXISTS "feed_reports_event_idx" ON "public"."feed_reports" USING "btree" ("event_id");



CREATE UNIQUE INDEX IF NOT EXISTS "feed_reports_event_unique" ON "public"."feed_reports" USING "btree" ("reporter_id", "event_id") WHERE ("event_id" IS NOT NULL);



CREATE INDEX IF NOT EXISTS "follows_followed_idx" ON "public"."follows" USING "btree" ("followed_id");



CREATE INDEX IF NOT EXISTS "list_problems_list_id_idx" ON "public"."list_problems" USING "btree" ("list_id");



CREATE UNIQUE INDEX IF NOT EXISTS "list_problems_list_slug_unique" ON "public"."list_problems" USING "btree" ("list_id", "title_slug");



CREATE INDEX IF NOT EXISTS "notebook_owner_idx" ON "public"."notebook_notes" USING "btree" ("owner_id", "updated_at" DESC);



CREATE INDEX IF NOT EXISTS "notebook_squad_idx" ON "public"."notebook_notes" USING "btree" ("squad_id") WHERE ("visibility" = 'squad'::"text");



CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_open_unique" ON "public"."notifications" USING "btree" ("user_id", "kind", "dedupe_key") WHERE (("dedupe_key" IS NOT NULL) AND ("read_at" IS NULL));



CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX IF NOT EXISTS "platform_posts_recent_idx" ON "public"."platform_posts" USING "btree" ("pinned" DESC, "created_at" DESC);



CREATE INDEX IF NOT EXISTS "primers_pattern_idx" ON "public"."primers" USING "btree" ("pattern");



CREATE INDEX IF NOT EXISTS "problem_events_slug_idx" ON "public"."problem_events" USING "btree" ("problem_slug", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "problem_events_user_slug_idx" ON "public"."problem_events" USING "btree" ("user_id", "problem_slug", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "problems_difficulty_idx" ON "public"."problems" USING "btree" ("difficulty");



CREATE INDEX IF NOT EXISTS "problems_question_id_idx" ON "public"."problems" USING "btree" ("question_id");



CREATE UNIQUE INDEX IF NOT EXISTS "profiles_leetcode_username_lower_unique" ON "public"."profiles" USING "btree" ("lower"("leetcode_username"));



CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX IF NOT EXISTS "recommendation_log_decision_idx" ON "public"."recommendation_log" USING "btree" ("decision", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "recommendation_log_user_idx" ON "public"."recommendation_log" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX IF NOT EXISTS "review_queue_open_unique" ON "public"."review_queue" USING "btree" ("user_id", "problem_slug", "reason") WHERE ("done_at" IS NULL);



CREATE INDEX IF NOT EXISTS "review_queue_user_open_idx" ON "public"."review_queue" USING "btree" ("user_id", "due_at") WHERE ("done_at" IS NULL);



CREATE INDEX IF NOT EXISTS "shared_resources_author_id_idx" ON "public"."shared_resources" USING "btree" ("author_id");



CREATE INDEX IF NOT EXISTS "squad_goals_active_idx" ON "public"."squad_goals" USING "btree" ("squad_id", "created_at" DESC) WHERE (("status" = 'active'::"text") AND ("archived" = false));



CREATE INDEX IF NOT EXISTS "squad_goals_squad_idx" ON "public"."squad_goals" USING "btree" ("squad_id") WHERE ("status" = 'active'::"text");



CREATE INDEX IF NOT EXISTS "squad_members_squad_idx" ON "public"."squad_members" USING "btree" ("squad_id");



CREATE INDEX IF NOT EXISTS "squad_members_user_idx" ON "public"."squad_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX IF NOT EXISTS "squad_milestones_kind_once" ON "public"."squad_milestones" USING "btree" ("squad_id", "kind");



CREATE INDEX IF NOT EXISTS "squad_milestones_squad_idx" ON "public"."squad_milestones" USING "btree" ("squad_id", "occurred_at" DESC);



CREATE INDEX IF NOT EXISTS "squad_recaps_squad_idx" ON "public"."squad_recaps" USING "btree" ("squad_id", "week_start" DESC);



CREATE UNIQUE INDEX IF NOT EXISTS "squad_recaps_week_unique" ON "public"."squad_recaps" USING "btree" ("squad_id", "week_start");



CREATE INDEX IF NOT EXISTS "squad_referrals_referrer_idx" ON "public"."squad_referrals" USING "btree" ("referrer_id");



CREATE INDEX IF NOT EXISTS "squad_referrals_squad_idx" ON "public"."squad_referrals" USING "btree" ("squad_id");



CREATE UNIQUE INDEX IF NOT EXISTS "squad_seasons_one_active" ON "public"."squad_seasons" USING "btree" ("squad_id") WHERE ("status" = 'active'::"text");



CREATE INDEX IF NOT EXISTS "squad_seasons_squad_idx" ON "public"."squad_seasons" USING "btree" ("squad_id", "starts_at" DESC);



CREATE INDEX IF NOT EXISTS "stuck_replies_request_idx" ON "public"."stuck_replies" USING "btree" ("request_id", "created_at");



CREATE INDEX IF NOT EXISTS "stuck_requests_open_idx" ON "public"."stuck_requests" USING "btree" ("created_at" DESC) WHERE ("status" = 'open'::"text");



CREATE INDEX IF NOT EXISTS "stuck_requests_problem_idx" ON "public"."stuck_requests" USING "btree" ("problem_slug", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "stuck_requests_user_idx" ON "public"."stuck_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX IF NOT EXISTS "suggestions_from_user_idx" ON "public"."suggestions" USING "btree" ("from_user");



CREATE INDEX IF NOT EXISTS "suggestions_parent_idx" ON "public"."suggestions" USING "btree" ("parent_id");



CREATE UNIQUE INDEX IF NOT EXISTS "suggestions_pending_unique" ON "public"."suggestions" USING "btree" ("to_user", "problem_slug") WHERE ("status" = 'pending'::"text");



CREATE INDEX IF NOT EXISTS "suggestions_reminded_idx" ON "public"."suggestions" USING "btree" ("reminded_at") WHERE ("reminded_at" IS NOT NULL);



CREATE INDEX IF NOT EXISTS "suggestions_to_pending_idx" ON "public"."suggestions" USING "btree" ("to_user", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX IF NOT EXISTS "suggestions_to_user_pending_idx" ON "public"."suggestions" USING "btree" ("to_user") WHERE ("status" = 'pending'::"text");



CREATE INDEX IF NOT EXISTS "sync_rate_limits_last_sync_idx" ON "public"."sync_rate_limits" USING "btree" ("last_sync_at");



CREATE INDEX IF NOT EXISTS "user_problem_status_user_id_idx" ON "public"."user_problem_status" USING "btree" ("user_id");



CREATE INDEX IF NOT EXISTS "validation_observations_category_idx" ON "public"."validation_observations" USING "btree" ("category");



CREATE INDEX IF NOT EXISTS "validation_observations_squad_idx" ON "public"."validation_observations" USING "btree" ("squad_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "assert_referral_referrer_is_member" BEFORE INSERT ON "public"."squad_referrals" FOR EACH ROW EXECUTE FUNCTION "public"."assert_referral_referrer_is_member"();



CREATE OR REPLACE TRIGGER "enforce_ai_ladder_ceiling" BEFORE INSERT ON "public"."ai_calls" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ai_ladder_ceiling"();



CREATE OR REPLACE TRIGGER "guard_product_admin" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_product_admin"();



CREATE OR REPLACE TRIGGER "lock_suggestion_parties" BEFORE UPDATE ON "public"."suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."lock_suggestion_parties"();



CREATE OR REPLACE TRIGGER "normalize_leetcode_username" BEFORE INSERT OR UPDATE OF "leetcode_username" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_leetcode_username"();



CREATE OR REPLACE TRIGGER "notify_challenge_completed" AFTER UPDATE ON "public"."suggestions" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."notify_challenge_completed"();



CREATE OR REPLACE TRIGGER "notify_challenge_received" AFTER INSERT ON "public"."suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_challenge_received"();



CREATE OR REPLACE TRIGGER "notify_recap_ready" AFTER INSERT ON "public"."squad_recaps" FOR EACH ROW EXECUTE FUNCTION "public"."notify_recap_ready"();



CREATE OR REPLACE TRIGGER "preserve_attempted_on_manual_import" BEFORE UPDATE ON "public"."user_problem_status" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_attempted_on_manual_import"();



CREATE OR REPLACE TRIGGER "record_first_challenge_milestone" AFTER INSERT ON "public"."suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."record_first_challenge_milestone"();



CREATE OR REPLACE TRIGGER "record_first_member_milestone" AFTER INSERT ON "public"."squad_members" FOR EACH ROW EXECUTE FUNCTION "public"."record_first_member_milestone"();



CREATE OR REPLACE TRIGGER "record_goal_complete_milestone" AFTER UPDATE ON "public"."squad_goals" FOR EACH ROW EXECUTE FUNCTION "public"."record_goal_complete_milestone"();



CREATE OR REPLACE TRIGGER "record_season_complete_milestone" AFTER UPDATE ON "public"."squad_seasons" FOR EACH ROW EXECUTE FUNCTION "public"."record_season_complete_milestone"();



CREATE OR REPLACE TRIGGER "record_solve_count_milestone" AFTER INSERT ON "public"."problem_events" FOR EACH ROW WHEN (("new"."kind" = ANY (ARRAY['solved'::"text", 'revisited'::"text"]))) EXECUTE FUNCTION "public"."record_solve_count_milestone"();



CREATE OR REPLACE TRIGGER "record_solve_milestone" AFTER UPDATE ON "public"."battles" FOR EACH ROW WHEN ((("old"."outcome" IS DISTINCT FROM "new"."outcome") AND ("new"."outcome" = 'solved'::"text"))) EXECUTE FUNCTION "public"."record_solve_milestone"();



CREATE OR REPLACE TRIGGER "refresh_fork_count_on_note_change" AFTER INSERT OR DELETE ON "public"."notebook_notes" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_note_fork_count"();



CREATE OR REPLACE TRIGGER "refresh_fork_counts_for_note" AFTER INSERT OR DELETE OR UPDATE ON "public"."notebook_notes" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_fork_counts_for_note"();



CREATE OR REPLACE TRIGGER "resolve_stuck_on_solve" AFTER UPDATE ON "public"."battles" FOR EACH ROW WHEN ((("old"."outcome" IS DISTINCT FROM "new"."outcome") AND ("new"."outcome" = 'solved'::"text"))) EXECUTE FUNCTION "public"."resolve_stuck_on_solve"();



CREATE OR REPLACE TRIGGER "stuck_reply_level" BEFORE INSERT ON "public"."stuck_replies" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_stuck_reply_level"();



CREATE OR REPLACE TRIGGER "stuck_request_limit" BEFORE INSERT ON "public"."stuck_requests" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_stuck_request_limit"();



CREATE OR REPLACE TRIGGER "sync_review_queue_on_battle_end" AFTER UPDATE ON "public"."battles" FOR EACH ROW WHEN ((("old"."outcome" IS DISTINCT FROM "new"."outcome") AND ("new"."outcome" = ANY (ARRAY['failed'::"text", 'solved'::"text"])))) EXECUTE FUNCTION "public"."sync_review_queue_from_battle"();



CREATE OR REPLACE TRIGGER "sync_suggestion_message" BEFORE INSERT OR UPDATE ON "public"."suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_suggestion_message"();



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_calls_squad_id_fkey' AND conrelid = '"public"."ai_calls"'::regclass) THEN
    ALTER TABLE "public"."ai_calls"
    ADD CONSTRAINT "ai_calls_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_calls_user_id_fkey' AND conrelid = '"public"."ai_calls"'::regclass) THEN
    ALTER TABLE "public"."ai_calls"
    ADD CONSTRAINT "ai_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'analytics_events_user_id_fkey' AND conrelid = '"public"."analytics_events"'::regclass) THEN
    ALTER TABLE "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'approaches_fork_of_fkey' AND conrelid = '"public"."approaches"'::regclass) THEN
    ALTER TABLE "public"."approaches"
    ADD CONSTRAINT "approaches_fork_of_fkey" FOREIGN KEY ("fork_of") REFERENCES "public"."approaches"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'approaches_squad_id_fkey' AND conrelid = '"public"."approaches"'::regclass) THEN
    ALTER TABLE "public"."approaches"
    ADD CONSTRAINT "approaches_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'approaches_user_id_fkey' AND conrelid = '"public"."approaches"'::regclass) THEN
    ALTER TABLE "public"."approaches"
    ADD CONSTRAINT "approaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'battles_challenge_id_fkey' AND conrelid = '"public"."battles"'::regclass) THEN
    ALTER TABLE "public"."battles"
    ADD CONSTRAINT "battles_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."suggestions"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'battles_squad_id_fkey' AND conrelid = '"public"."battles"'::regclass) THEN
    ALTER TABLE "public"."battles"
    ADD CONSTRAINT "battles_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'battles_user_id_fkey' AND conrelid = '"public"."battles"'::regclass) THEN
    ALTER TABLE "public"."battles"
    ADD CONSTRAINT "battles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'custom_lists_created_by_fkey' AND conrelid = '"public"."custom_lists"'::regclass) THEN
    ALTER TABLE "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'daily_battles_user_id_fkey' AND conrelid = '"public"."daily_battles"'::regclass) THEN
    ALTER TABLE "public"."daily_battles"
    ADD CONSTRAINT "daily_battles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussion_replies_author_id_fkey' AND conrelid = '"public"."discussion_replies"'::regclass) THEN
    ALTER TABLE "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussion_replies_discussion_id_fkey' AND conrelid = '"public"."discussion_replies"'::regclass) THEN
    ALTER TABLE "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussions_author_id_fkey' AND conrelid = '"public"."discussions"'::regclass) THEN
    ALTER TABLE "public"."discussions"
    ADD CONSTRAINT "discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'discussions_squad_id_fkey' AND conrelid = '"public"."discussions"'::regclass) THEN
    ALTER TABLE "public"."discussions"
    ADD CONSTRAINT "discussions_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feature_triage_decided_by_fkey' AND conrelid = '"public"."feature_triage"'::regclass) THEN
    ALTER TABLE "public"."feature_triage"
    ADD CONSTRAINT "feature_triage_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_events_squad_id_fkey' AND conrelid = '"public"."feed_events"'::regclass) THEN
    ALTER TABLE "public"."feed_events"
    ADD CONSTRAINT "feed_events_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_events_user_id_fkey' AND conrelid = '"public"."feed_events"'::regclass) THEN
    ALTER TABLE "public"."feed_events"
    ADD CONSTRAINT "feed_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_reports_discussion_id_fkey' AND conrelid = '"public"."feed_reports"'::regclass) THEN
    ALTER TABLE "public"."feed_reports"
    ADD CONSTRAINT "feed_reports_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_reports_event_id_fkey' AND conrelid = '"public"."feed_reports"'::regclass) THEN
    ALTER TABLE "public"."feed_reports"
    ADD CONSTRAINT "feed_reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."feed_events"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'feed_reports_reporter_id_fkey' AND conrelid = '"public"."feed_reports"'::regclass) THEN
    ALTER TABLE "public"."feed_reports"
    ADD CONSTRAINT "feed_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'follows_followed_id_fkey' AND conrelid = '"public"."follows"'::regclass) THEN
    ALTER TABLE "public"."follows"
    ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'follows_follower_id_fkey' AND conrelid = '"public"."follows"'::regclass) THEN
    ALTER TABLE "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'list_problems_list_id_fkey' AND conrelid = '"public"."list_problems"'::regclass) THEN
    ALTER TABLE "public"."list_problems"
    ADD CONSTRAINT "list_problems_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."custom_lists"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'note_shares_note_id_fkey' AND conrelid = '"public"."note_shares"'::regclass) THEN
    ALTER TABLE "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notebook_notes"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'note_shares_shared_with_fkey' AND conrelid = '"public"."note_shares"'::regclass) THEN
    ALTER TABLE "public"."note_shares"
    ADD CONSTRAINT "note_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notebook_notes_owner_id_fkey' AND conrelid = '"public"."notebook_notes"'::regclass) THEN
    ALTER TABLE "public"."notebook_notes"
    ADD CONSTRAINT "notebook_notes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notebook_notes_squad_id_fkey' AND conrelid = '"public"."notebook_notes"'::regclass) THEN
    ALTER TABLE "public"."notebook_notes"
    ADD CONSTRAINT "notebook_notes_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notifications_actor_id_fkey' AND conrelid = '"public"."notifications"'::regclass) THEN
    ALTER TABLE "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notifications_user_id_fkey' AND conrelid = '"public"."notifications"'::regclass) THEN
    ALTER TABLE "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'platform_posts_author_id_fkey' AND conrelid = '"public"."platform_posts"'::regclass) THEN
    ALTER TABLE "public"."platform_posts"
    ADD CONSTRAINT "platform_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'primers_author_id_fkey' AND conrelid = '"public"."primers"'::regclass) THEN
    ALTER TABLE "public"."primers"
    ADD CONSTRAINT "primers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'primers_squad_id_fkey' AND conrelid = '"public"."primers"'::regclass) THEN
    ALTER TABLE "public"."primers"
    ADD CONSTRAINT "primers_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'problem_events_battle_id_fkey' AND conrelid = '"public"."problem_events"'::regclass) THEN
    ALTER TABLE "public"."problem_events"
    ADD CONSTRAINT "problem_events_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'problem_events_user_id_fkey' AND conrelid = '"public"."problem_events"'::regclass) THEN
    ALTER TABLE "public"."problem_events"
    ADD CONSTRAINT "problem_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_active_squad_id_fkey' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_active_squad_id_fkey" FOREIGN KEY ("active_squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_id_fkey' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_invited_by_fkey' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_joined_via_referral_fkey' AND conrelid = '"public"."profiles"'::regclass) THEN
    ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_joined_via_referral_fkey" FOREIGN KEY ("joined_via_referral") REFERENCES "public"."squad_referrals"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'push_subscriptions_user_id_fkey' AND conrelid = '"public"."push_subscriptions"'::regclass) THEN
    ALTER TABLE "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'recommendation_log_user_id_fkey' AND conrelid = '"public"."recommendation_log"'::regclass) THEN
    ALTER TABLE "public"."recommendation_log"
    ADD CONSTRAINT "recommendation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'review_queue_user_id_fkey' AND conrelid = '"public"."review_queue"'::regclass) THEN
    ALTER TABLE "public"."review_queue"
    ADD CONSTRAINT "review_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'shared_resources_author_id_fkey' AND conrelid = '"public"."shared_resources"'::regclass) THEN
    ALTER TABLE "public"."shared_resources"
    ADD CONSTRAINT "shared_resources_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'shared_resources_squad_id_fkey' AND conrelid = '"public"."shared_resources"'::regclass) THEN
    ALTER TABLE "public"."shared_resources"
    ADD CONSTRAINT "shared_resources_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_goals_created_by_fkey' AND conrelid = '"public"."squad_goals"'::regclass) THEN
    ALTER TABLE "public"."squad_goals"
    ADD CONSTRAINT "squad_goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_goals_squad_id_fkey' AND conrelid = '"public"."squad_goals"'::regclass) THEN
    ALTER TABLE "public"."squad_goals"
    ADD CONSTRAINT "squad_goals_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_members_squad_id_fkey' AND conrelid = '"public"."squad_members"'::regclass) THEN
    ALTER TABLE "public"."squad_members"
    ADD CONSTRAINT "squad_members_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_members_user_id_fkey' AND conrelid = '"public"."squad_members"'::regclass) THEN
    ALTER TABLE "public"."squad_members"
    ADD CONSTRAINT "squad_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_milestones_squad_id_fkey' AND conrelid = '"public"."squad_milestones"'::regclass) THEN
    ALTER TABLE "public"."squad_milestones"
    ADD CONSTRAINT "squad_milestones_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_recaps_generated_by_fkey' AND conrelid = '"public"."squad_recaps"'::regclass) THEN
    ALTER TABLE "public"."squad_recaps"
    ADD CONSTRAINT "squad_recaps_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_recaps_squad_id_fkey' AND conrelid = '"public"."squad_recaps"'::regclass) THEN
    ALTER TABLE "public"."squad_recaps"
    ADD CONSTRAINT "squad_recaps_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_referrals_referrer_id_fkey' AND conrelid = '"public"."squad_referrals"'::regclass) THEN
    ALTER TABLE "public"."squad_referrals"
    ADD CONSTRAINT "squad_referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_referrals_squad_id_fkey' AND conrelid = '"public"."squad_referrals"'::regclass) THEN
    ALTER TABLE "public"."squad_referrals"
    ADD CONSTRAINT "squad_referrals_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_seasons_created_by_fkey' AND conrelid = '"public"."squad_seasons"'::regclass) THEN
    ALTER TABLE "public"."squad_seasons"
    ADD CONSTRAINT "squad_seasons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squad_seasons_squad_id_fkey' AND conrelid = '"public"."squad_seasons"'::regclass) THEN
    ALTER TABLE "public"."squad_seasons"
    ADD CONSTRAINT "squad_seasons_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'squads_created_by_fkey' AND conrelid = '"public"."squads"'::regclass) THEN
    ALTER TABLE "public"."squads"
    ADD CONSTRAINT "squads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_replies_author_id_fkey' AND conrelid = '"public"."stuck_replies"'::regclass) THEN
    ALTER TABLE "public"."stuck_replies"
    ADD CONSTRAINT "stuck_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_replies_request_id_fkey' AND conrelid = '"public"."stuck_replies"'::regclass) THEN
    ALTER TABLE "public"."stuck_replies"
    ADD CONSTRAINT "stuck_replies_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."stuck_requests"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_requests_battle_id_fkey' AND conrelid = '"public"."stuck_requests"'::regclass) THEN
    ALTER TABLE "public"."stuck_requests"
    ADD CONSTRAINT "stuck_requests_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_requests_squad_id_fkey' AND conrelid = '"public"."stuck_requests"'::regclass) THEN
    ALTER TABLE "public"."stuck_requests"
    ADD CONSTRAINT "stuck_requests_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'stuck_requests_user_id_fkey' AND conrelid = '"public"."stuck_requests"'::regclass) THEN
    ALTER TABLE "public"."stuck_requests"
    ADD CONSTRAINT "stuck_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_from_user_fkey' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_parent_id_fkey' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."suggestions"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_to_user_fkey' AND conrelid = '"public"."suggestions"'::regclass) THEN
    ALTER TABLE "public"."suggestions"
    ADD CONSTRAINT "suggestions_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'sync_rate_limits_user_id_fkey' AND conrelid = '"public"."sync_rate_limits"'::regclass) THEN
    ALTER TABLE "public"."sync_rate_limits"
    ADD CONSTRAINT "sync_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_blocks_blocked_id_fkey' AND conrelid = '"public"."user_blocks"'::regclass) THEN
    ALTER TABLE "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_blocks_blocker_id_fkey' AND conrelid = '"public"."user_blocks"'::regclass) THEN
    ALTER TABLE "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_problem_status_user_id_fkey' AND conrelid = '"public"."user_problem_status"'::regclass) THEN
    ALTER TABLE "public"."user_problem_status"
    ADD CONSTRAINT "user_problem_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'validation_observations_observed_by_fkey' AND conrelid = '"public"."validation_observations"'::regclass) THEN
    ALTER TABLE "public"."validation_observations"
    ADD CONSTRAINT "validation_observations_observed_by_fkey" FOREIGN KEY ("observed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END
$guard$;



DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'validation_observations_squad_id_fkey' AND conrelid = '"public"."validation_observations"'::regclass) THEN
    ALTER TABLE "public"."validation_observations"
    ADD CONSTRAINT "validation_observations_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE CASCADE;
  END IF;
END
$guard$;



DROP POLICY IF EXISTS "Admins decide triage" ON "public"."feature_triage";
CREATE POLICY "Admins decide triage" ON "public"."feature_triage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND "p"."is_product_admin")))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND "p"."is_product_admin"))));



DROP POLICY IF EXISTS "Allow public read access for catalog_sync_state" ON "public"."catalog_sync_state";
CREATE POLICY "Allow public read access for catalog_sync_state" ON "public"."catalog_sync_state" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for feed_events" ON "public"."feed_events";
CREATE POLICY "Allow public read access for feed_events" ON "public"."feed_events" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for lists" ON "public"."custom_lists";
CREATE POLICY "Allow public read access for lists" ON "public"."custom_lists" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for problems" ON "public"."problems";
CREATE POLICY "Allow public read access for problems" ON "public"."problems" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for profiles" ON "public"."profiles";
CREATE POLICY "Allow public read access for profiles" ON "public"."profiles" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for suggestions" ON "public"."suggestions";
CREATE POLICY "Allow public read access for suggestions" ON "public"."suggestions" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public read access for user_problem_status" ON "public"."user_problem_status";
CREATE POLICY "Allow public read access for user_problem_status" ON "public"."user_problem_status" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Authors create own stuck replies" ON "public"."stuck_replies";
CREATE POLICY "Authors create own stuck replies" ON "public"."stuck_replies" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Authors create own stuck requests" ON "public"."stuck_requests";
CREATE POLICY "Authors create own stuck requests" ON "public"."stuck_requests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Authors delete own discussions" ON "public"."discussions";
CREATE POLICY "Authors delete own discussions" ON "public"."discussions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Authors delete own replies" ON "public"."discussion_replies";
CREATE POLICY "Authors delete own replies" ON "public"."discussion_replies" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Authors delete own stuck replies" ON "public"."stuck_replies";
CREATE POLICY "Authors delete own stuck replies" ON "public"."stuck_replies" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Authors delete own stuck requests" ON "public"."stuck_requests";
CREATE POLICY "Authors delete own stuck requests" ON "public"."stuck_requests" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Authors update own discussions" ON "public"."discussions";
CREATE POLICY "Authors update own discussions" ON "public"."discussions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Authors update own stuck requests" ON "public"."stuck_requests";
CREATE POLICY "Authors update own stuck requests" ON "public"."stuck_requests" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Contests publicly readable" ON "public"."contests";
CREATE POLICY "Contests publicly readable" ON "public"."contests" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Discussions publicly readable" ON "public"."discussions";
CREATE POLICY "Discussions publicly readable" ON "public"."discussions" FOR SELECT USING (("deleted_at" IS NULL));



DROP POLICY IF EXISTS "Everyone reads triage" ON "public"."feature_triage";
CREATE POLICY "Everyone reads triage" ON "public"."feature_triage" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Follows readable by both parties" ON "public"."follows";
CREATE POLICY "Follows readable by both parties" ON "public"."follows" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "follower_id") OR (( SELECT "auth"."uid"() AS "uid") = "followed_id")));



DROP POLICY IF EXISTS "Generators delete own recaps" ON "public"."squad_recaps";
CREATE POLICY "Generators delete own recaps" ON "public"."squad_recaps" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "generated_by"));



DROP POLICY IF EXISTS "Generators update own recaps" ON "public"."squad_recaps";
CREATE POLICY "Generators update own recaps" ON "public"."squad_recaps" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "generated_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "generated_by"));



DROP POLICY IF EXISTS "Members can leave, creator can remove" ON "public"."squad_members";
CREATE POLICY "Members can leave, creator can remove" ON "public"."squad_members" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."squads"
  WHERE (("squads"."id" = "squad_members"."squad_id") AND ("squads"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Members create own referral links" ON "public"."squad_referrals";
CREATE POLICY "Members create own referral links" ON "public"."squad_referrals" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "referrer_id") AND (EXISTS ( SELECT 1
   FROM "public"."squad_members" "m"
  WHERE (("m"."squad_id" = "squad_referrals"."squad_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "No client access to sync rate limits" ON "public"."sync_rate_limits";
CREATE POLICY "No client access to sync rate limits" ON "public"."sync_rate_limits" USING (false) WITH CHECK (false);



DROP POLICY IF EXISTS "Owners and editors can update notes" ON "public"."notebook_notes";
CREATE POLICY "Owners and editors can update notes" ON "public"."notebook_notes" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."note_shares"
  WHERE (("note_shares"."note_id" = "notebook_notes"."id") AND ("note_shares"."shared_with" = ( SELECT "auth"."uid"() AS "uid")) AND ("note_shares"."can_edit" = true)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."note_shares"
  WHERE (("note_shares"."note_id" = "notebook_notes"."id") AND ("note_shares"."shared_with" = ( SELECT "auth"."uid"() AS "uid")) AND ("note_shares"."can_edit" = true))))));



DROP POLICY IF EXISTS "Owners can delete approaches" ON "public"."approaches";
CREATE POLICY "Owners can delete approaches" ON "public"."approaches" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Owners can delete notes" ON "public"."notebook_notes";
CREATE POLICY "Owners can delete notes" ON "public"."notebook_notes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



DROP POLICY IF EXISTS "Owners can delete primers" ON "public"."primers";
CREATE POLICY "Owners can delete primers" ON "public"."primers" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Owners can manage primers" ON "public"."primers";
CREATE POLICY "Owners can manage primers" ON "public"."primers" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Owners can update approaches" ON "public"."approaches";
CREATE POLICY "Owners can update approaches" ON "public"."approaches" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Owners manage shares" ON "public"."note_shares";
CREATE POLICY "Owners manage shares" ON "public"."note_shares" USING ((EXISTS ( SELECT 1
   FROM "public"."notebook_notes"
  WHERE (("notebook_notes"."id" = "note_shares"."note_id") AND ("notebook_notes"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notebook_notes"
  WHERE (("notebook_notes"."id" = "note_shares"."note_id") AND ("notebook_notes"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Owners see own approaches" ON "public"."approaches";
CREATE POLICY "Owners see own approaches" ON "public"."approaches" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Owners see own notes" ON "public"."notebook_notes";
CREATE POLICY "Owners see own notes" ON "public"."notebook_notes" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



DROP POLICY IF EXISTS "Owners see own primers" ON "public"."primers";
CREATE POLICY "Owners see own primers" ON "public"."primers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Participants manage stuck replies" ON "public"."stuck_replies";
CREATE POLICY "Participants manage stuck replies" ON "public"."stuck_replies" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "author_id") OR (EXISTS ( SELECT 1
   FROM "public"."stuck_requests" "r"
  WHERE (("r"."id" = "stuck_replies"."request_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "author_id") OR (EXISTS ( SELECT 1
   FROM "public"."stuck_requests" "r"
  WHERE (("r"."id" = "stuck_replies"."request_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Platform posts readable" ON "public"."platform_posts";
CREATE POLICY "Platform posts readable" ON "public"."platform_posts" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Problem events publicly readable" ON "public"."problem_events";
CREATE POLICY "Problem events publicly readable" ON "public"."problem_events" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Product admins post platform notes" ON "public"."platform_posts";
CREATE POLICY "Product admins post platform notes" ON "public"."platform_posts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND "p"."is_product_admin"))));



DROP POLICY IF EXISTS "Public approaches readable" ON "public"."approaches";
CREATE POLICY "Public approaches readable" ON "public"."approaches" FOR SELECT USING (("visibility" = 'public'::"text"));



DROP POLICY IF EXISTS "Public notes readable" ON "public"."notebook_notes";
CREATE POLICY "Public notes readable" ON "public"."notebook_notes" FOR SELECT USING (("visibility" = 'public'::"text"));



DROP POLICY IF EXISTS "Public primers readable" ON "public"."primers";
CREATE POLICY "Public primers readable" ON "public"."primers" FOR SELECT USING (("visibility" = 'public'::"text"));



DROP POLICY IF EXISTS "Public vault readable" ON "public"."shared_resources";
CREATE POLICY "Public vault readable" ON "public"."shared_resources" FOR SELECT USING (("visibility" = 'public'::"text"));



DROP POLICY IF EXISTS "Recipients see own shares" ON "public"."note_shares";
CREATE POLICY "Recipients see own shares" ON "public"."note_shares" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "shared_with"));



DROP POLICY IF EXISTS "Referrer and invitee see a referral" ON "public"."squad_referrals";
CREATE POLICY "Referrer and invitee see a referral" ON "public"."squad_referrals" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "referrer_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."joined_via_referral" = "squad_referrals"."id"))))));



DROP POLICY IF EXISTS "Replies publicly readable" ON "public"."discussion_replies";
CREATE POLICY "Replies publicly readable" ON "public"."discussion_replies" FOR SELECT USING (("deleted_at" IS NULL));



DROP POLICY IF EXISTS "Reporters see own reports" ON "public"."feed_reports";
CREATE POLICY "Reporters see own reports" ON "public"."feed_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



DROP POLICY IF EXISTS "Researchers read observations" ON "public"."validation_observations";
CREATE POLICY "Researchers read observations" ON "public"."validation_observations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "observed_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND "p"."is_product_admin")))));



DROP POLICY IF EXISTS "Researchers write observations" ON "public"."validation_observations";
CREATE POLICY "Researchers write observations" ON "public"."validation_observations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "observed_by"));



DROP POLICY IF EXISTS "Shared notes readable" ON "public"."notebook_notes";
CREATE POLICY "Shared notes readable" ON "public"."notebook_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."note_shares"
  WHERE (("note_shares"."note_id" = "notebook_notes"."id") AND ("note_shares"."shared_with" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad creator can delete" ON "public"."squads";
CREATE POLICY "Squad creator can delete" ON "public"."squads" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Squad creator can update" ON "public"."squads";
CREATE POLICY "Squad creator can update" ON "public"."squads" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Squad goals publicly readable" ON "public"."squad_goals";
CREATE POLICY "Squad goals publicly readable" ON "public"."squad_goals" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Squad members can create goals" ON "public"."squad_goals";
CREATE POLICY "Squad members can create goals" ON "public"."squad_goals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members can delete goals" ON "public"."squad_goals";
CREATE POLICY "Squad members can delete goals" ON "public"."squad_goals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members can manage goals" ON "public"."squad_goals";
CREATE POLICY "Squad members can manage goals" ON "public"."squad_goals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members create recaps" ON "public"."squad_recaps";
CREATE POLICY "Squad members create recaps" ON "public"."squad_recaps" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members create seasons" ON "public"."squad_seasons";
CREATE POLICY "Squad members create seasons" ON "public"."squad_seasons" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members delete seasons" ON "public"."squad_seasons";
CREATE POLICY "Squad members delete seasons" ON "public"."squad_seasons" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad members publicly readable" ON "public"."squad_members";
CREATE POLICY "Squad members publicly readable" ON "public"."squad_members" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Squad members see squad approaches" ON "public"."approaches";
CREATE POLICY "Squad members see squad approaches" ON "public"."approaches" FOR SELECT USING ((("visibility" = 'squad'::"text") AND ("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "approaches"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Squad members update seasons" ON "public"."squad_seasons";
CREATE POLICY "Squad members update seasons" ON "public"."squad_seasons" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "squad_members"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "Squad milestones publicly readable" ON "public"."squad_milestones";
CREATE POLICY "Squad milestones publicly readable" ON "public"."squad_milestones" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Squad notes readable" ON "public"."notebook_notes";
CREATE POLICY "Squad notes readable" ON "public"."notebook_notes" FOR SELECT USING ((("visibility" = 'squad'::"text") AND ("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "notebook_notes"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Squad primers readable" ON "public"."primers";
CREATE POLICY "Squad primers readable" ON "public"."primers" FOR SELECT USING ((("visibility" = 'squad'::"text") AND ("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "primers"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Squad recaps publicly readable" ON "public"."squad_recaps";
CREATE POLICY "Squad recaps publicly readable" ON "public"."squad_recaps" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Squad seasons publicly readable" ON "public"."squad_seasons";
CREATE POLICY "Squad seasons publicly readable" ON "public"."squad_seasons" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Squad vault readable" ON "public"."shared_resources";
CREATE POLICY "Squad vault readable" ON "public"."shared_resources" FOR SELECT USING ((("visibility" = 'squad'::"text") AND ("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "shared_resources"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



DROP POLICY IF EXISTS "Squads publicly readable" ON "public"."squads";
CREATE POLICY "Squads publicly readable" ON "public"."squads" FOR SELECT USING (true);



DROP POLICY IF EXISTS "Stuck replies readable by participants" ON "public"."stuck_replies";
CREATE POLICY "Stuck replies readable by participants" ON "public"."stuck_replies" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."stuck_requests" "r"
  WHERE (("r"."id" = "stuck_replies"."request_id") AND (("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("r"."visibility" = ANY (ARRAY['public'::"text", 'anon'::"text"])) OR (("r"."squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."squad_members"
          WHERE (("squad_members"."squad_id" = "r"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))) OR (( SELECT "auth"."uid"() AS "uid") = "author_id")));



DROP POLICY IF EXISTS "Stuck requests readable by participants" ON "public"."stuck_requests";
CREATE POLICY "Stuck requests readable by participants" ON "public"."stuck_requests" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("visibility" = 'public'::"text") OR ("visibility" = 'anon'::"text") OR (("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "stuck_requests"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



DROP POLICY IF EXISTS "Users append own analytics" ON "public"."analytics_events";
CREATE POLICY "Users append own analytics" ON "public"."analytics_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users block and unblock" ON "public"."user_blocks";
CREATE POLICY "Users block and unblock" ON "public"."user_blocks" USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



DROP POLICY IF EXISTS "Users can append own problem events" ON "public"."problem_events";
CREATE POLICY "Users can append own problem events" ON "public"."problem_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can create approaches" ON "public"."approaches";
CREATE POLICY "Users can create approaches" ON "public"."approaches" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can create custom lists" ON "public"."custom_lists";
CREATE POLICY "Users can create custom lists" ON "public"."custom_lists" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Users can create notes" ON "public"."notebook_notes";
CREATE POLICY "Users can create notes" ON "public"."notebook_notes" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") AND ("visibility" = ANY (ARRAY['private'::"text", 'squad'::"text", 'public'::"text"])) AND (("visibility" <> 'squad'::"text") OR (("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "notebook_notes"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



DROP POLICY IF EXISTS "Users can create own feed events" ON "public"."feed_events";
CREATE POLICY "Users can create own feed events" ON "public"."feed_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can create primers" ON "public"."primers";
CREATE POLICY "Users can create primers" ON "public"."primers" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Users can create squads" ON "public"."squads";
CREATE POLICY "Users can create squads" ON "public"."squads" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Users can delete own custom lists" ON "public"."custom_lists";
CREATE POLICY "Users can delete own custom lists" ON "public"."custom_lists" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Users can delete own problem status" ON "public"."user_problem_status";
CREATE POLICY "Users can delete own problem status" ON "public"."user_problem_status" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can delete own sent suggestions" ON "public"."suggestions";
CREATE POLICY "Users can delete own sent suggestions" ON "public"."suggestions" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "from_user") AND ("status" = 'pending'::"text")));



DROP POLICY IF EXISTS "Users can delete own shared resources" ON "public"."shared_resources";
CREATE POLICY "Users can delete own shared resources" ON "public"."shared_resources" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Users can insert feed events" ON "public"."feed_events";
CREATE POLICY "Users can insert feed events" ON "public"."feed_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."profiles";
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



DROP POLICY IF EXISTS "Users can insert problem status" ON "public"."user_problem_status";
CREATE POLICY "Users can insert problem status" ON "public"."user_problem_status" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can insert shared resources" ON "public"."shared_resources";
CREATE POLICY "Users can insert shared resources" ON "public"."shared_resources" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "author_id") AND ("visibility" = ANY (ARRAY['public'::"text", 'squad'::"text"])) AND (("visibility" = 'public'::"text") OR (("squad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."squad_members"
  WHERE (("squad_members"."squad_id" = "shared_resources"."squad_id") AND ("squad_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



DROP POLICY IF EXISTS "Users can insert suggestions" ON "public"."suggestions";
CREATE POLICY "Users can insert suggestions" ON "public"."suggestions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "from_user"));



DROP POLICY IF EXISTS "Users can manage own feed events" ON "public"."feed_events";
CREATE POLICY "Users can manage own feed events" ON "public"."feed_events" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can manage own problem status" ON "public"."user_problem_status";
CREATE POLICY "Users can manage own problem status" ON "public"."user_problem_status" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can manage own suggestions" ON "public"."suggestions";
CREATE POLICY "Users can manage own suggestions" ON "public"."suggestions" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "from_user") OR (( SELECT "auth"."uid"() AS "uid") = "to_user"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "from_user") OR (( SELECT "auth"."uid"() AS "uid") = "to_user")));



DROP POLICY IF EXISTS "Users can manage push subscriptions" ON "public"."push_subscriptions";
CREATE POLICY "Users can manage push subscriptions" ON "public"."push_subscriptions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users can update own custom lists" ON "public"."custom_lists";
CREATE POLICY "Users can update own custom lists" ON "public"."custom_lists" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



DROP POLICY IF EXISTS "Users can update own display name" ON "public"."profiles";
CREATE POLICY "Users can update own display name" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



DROP POLICY IF EXISTS "Users can update own shared resources" ON "public"."shared_resources";
CREATE POLICY "Users can update own shared resources" ON "public"."shared_resources" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Users create discussions" ON "public"."discussions";
CREATE POLICY "Users create discussions" ON "public"."discussions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Users create replies" ON "public"."discussion_replies";
CREATE POLICY "Users create replies" ON "public"."discussion_replies" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



DROP POLICY IF EXISTS "Users delete own daily battles" ON "public"."daily_battles";
CREATE POLICY "Users delete own daily battles" ON "public"."daily_battles" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users delete own notifications" ON "public"."notifications";
CREATE POLICY "Users delete own notifications" ON "public"."notifications" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users follow and unfollow themselves" ON "public"."follows";
CREATE POLICY "Users follow and unfollow themselves" ON "public"."follows" USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



DROP POLICY IF EXISTS "Users insert own daily battles" ON "public"."daily_battles";
CREATE POLICY "Users insert own daily battles" ON "public"."daily_battles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users log own recommendations" ON "public"."recommendation_log";
CREATE POLICY "Users log own recommendations" ON "public"."recommendation_log" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users manage own battles" ON "public"."battles";
CREATE POLICY "Users manage own battles" ON "public"."battles" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users manage own review queue" ON "public"."review_queue";
CREATE POLICY "Users manage own review queue" ON "public"."review_queue" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users mark own notifications read" ON "public"."notifications";
CREATE POLICY "Users mark own notifications read" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users read own AI calls" ON "public"."ai_calls";
CREATE POLICY "Users read own AI calls" ON "public"."ai_calls" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users read own daily battles" ON "public"."daily_battles";
CREATE POLICY "Users read own daily battles" ON "public"."daily_battles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users read own notifications" ON "public"."notifications";
CREATE POLICY "Users read own notifications" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users report content" ON "public"."feed_reports";
CREATE POLICY "Users report content" ON "public"."feed_reports" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



DROP POLICY IF EXISTS "Users see own blocks" ON "public"."user_blocks";
CREATE POLICY "Users see own blocks" ON "public"."user_blocks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



DROP POLICY IF EXISTS "Users see own recommendation log" ON "public"."recommendation_log";
CREATE POLICY "Users see own recommendation log" ON "public"."recommendation_log" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users update own daily battles" ON "public"."daily_battles";
CREATE POLICY "Users update own daily battles" ON "public"."daily_battles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



DROP POLICY IF EXISTS "Users update own recommendation decisions" ON "public"."recommendation_log";
CREATE POLICY "Users update own recommendation decisions" ON "public"."recommendation_log" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."ai_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."battles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_sync_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_battles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussion_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_triage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."list_problems" ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "list_problems_owner_delete" ON "public"."list_problems";
CREATE POLICY "list_problems_owner_delete" ON "public"."list_problems" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."custom_lists"
  WHERE (("custom_lists"."id" = "list_problems"."list_id") AND ("custom_lists"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "list_problems_owner_insert" ON "public"."list_problems";
CREATE POLICY "list_problems_owner_insert" ON "public"."list_problems" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."custom_lists"
  WHERE (("custom_lists"."id" = "list_problems"."list_id") AND ("custom_lists"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "list_problems_owner_update" ON "public"."list_problems";
CREATE POLICY "list_problems_owner_update" ON "public"."list_problems" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."custom_lists"
  WHERE (("custom_lists"."id" = "list_problems"."list_id") AND ("custom_lists"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."custom_lists"
  WHERE (("custom_lists"."id" = "list_problems"."list_id") AND ("custom_lists"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



DROP POLICY IF EXISTS "list_problems_public_read" ON "public"."list_problems";
CREATE POLICY "list_problems_public_read" ON "public"."list_problems" FOR SELECT USING (true);



ALTER TABLE "public"."note_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notebook_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."primers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problem_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_recaps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squad_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."squads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stuck_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stuck_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_problem_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."validation_observations" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_calls_remaining"("p_squad" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assert_referral_referrer_is_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."assert_referral_referrer_is_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_referral_referrer_is_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."attribute_join"("p_referral_token" "text", "p_squad_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_referral_open"("p_referral_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_discussion"("p_problem_slug" "text", "p_pattern_tags" "text"[], "p_body_md" "text", "p_visibility" "text", "p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_discussion"("p_problem_slug" "text", "p_pattern_tags" "text"[], "p_body_md" "text", "p_visibility" "text", "p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_discussion"("p_problem_slug" "text", "p_pattern_tags" "text"[], "p_body_md" "text", "p_visibility" "text", "p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_discussion_id" "uuid", "p_body_md" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_discussion_id" "uuid", "p_body_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_discussion_id" "uuid", "p_body_md" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."default_leaderboard_segment"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."default_leaderboard_segment"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."default_leaderboard_segment"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."discussion_is_actionable"("p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."discussion_is_actionable"("p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."discussion_is_actionable"("p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."discussion_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."discussion_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."discussion_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_ai_ladder_ceiling"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_ai_ladder_ceiling"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_ai_ladder_ceiling"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_stuck_reply_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_stuck_reply_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_stuck_reply_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_stuck_request_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_stuck_request_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_stuck_request_limit"() TO "service_role";



GRANT ALL ON TABLE "public"."feed_events" TO "anon";
GRANT ALL ON TABLE "public"."feed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_events" TO "service_role";



GRANT ALL ON FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") TO "anon";
GRANT ALL ON FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") TO "authenticated";
GRANT ALL ON FUNCTION "public"."feed_usefulness"("p_event" "public"."feed_events") TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_activation"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_activation"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_activation"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_learning"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_learning"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_learning"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_organic"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_organic"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_organic"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_retention"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_retention"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_retention"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_social"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_social"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_social"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_squad_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_squad_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_squad_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ranked_feed"("p_scope" "text", "p_squad_id" "uuid", "p_viewer" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."global_leaderboard"("p_segment" "text", "p_pattern" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."global_post_min_solves"() TO "anon";
GRANT ALL ON FUNCTION "public"."global_post_min_solves"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."global_post_min_solves"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_product_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_product_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_product_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."in_quiet_hours"("p_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_suggestion_parties"() TO "anon";
GRANT ALL ON FUNCTION "public"."lock_suggestion_parties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_suggestion_parties"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_solved_from_leetcode"("p_user_id" "uuid", "p_slugs" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_solved_from_leetcode"("p_user_id" "uuid", "p_slugs" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."my_content_impact"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_content_impact"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_content_impact"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_referral_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_referral_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_referral_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_referral_links"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_leetcode_username"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_leetcode_username"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_leetcode_username"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_challenge_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_challenge_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_challenge_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_challenge_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_challenge_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_challenge_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_contest_reminders"("p_within" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."notify_contest_reminders"("p_within" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_contest_reminders"("p_within" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_goal_near_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_goal_near_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_goal_near_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_recap_ready"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_recap_ready"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_recap_ready"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preserve_attempted_on_manual_import"() TO "anon";
GRANT ALL ON FUNCTION "public"."preserve_attempted_on_manual_import"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preserve_attempted_on_manual_import"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_first_challenge_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_first_challenge_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_first_challenge_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_first_member_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_first_member_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_first_member_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_goal_complete_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_goal_complete_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_goal_complete_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_season_complete_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_season_complete_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_season_complete_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_solve_count_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_solve_count_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_solve_count_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_solve_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_solve_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_solve_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_fork_count"("p_source_table" "text", "p_source_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_fork_count"("p_source_table" "text", "p_source_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_fork_count"("p_source_table" "text", "p_source_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_fork_counts_for_note"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_fork_counts_for_note"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_fork_counts_for_note"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_note_fork_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_note_fork_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_note_fork_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reply_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."reply_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reply_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_stuck_on_solve"() TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_stuck_on_solve"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_stuck_on_solve"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stuck_reminder_allowed"("p_request_id" "uuid", "p_actor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."suggestion_remind_allowed"("p_suggestion_id" "uuid", "p_actor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_review_queue_from_battle"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_review_queue_from_battle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_review_queue_from_battle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_suggestion_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_suggestion_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_suggestion_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."teachers_for_pattern"("p_pattern" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validation_gate_board"("p_squad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validation_squads"() TO "anon";
GRANT ALL ON FUNCTION "public"."validation_squads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validation_squads"() TO "service_role";



GRANT ALL ON TABLE "public"."ai_calls" TO "anon";
GRANT ALL ON TABLE "public"."ai_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_calls" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."approaches" TO "anon";
GRANT ALL ON TABLE "public"."approaches" TO "authenticated";
GRANT ALL ON TABLE "public"."approaches" TO "service_role";



GRANT ALL ON TABLE "public"."battles" TO "anon";
GRANT ALL ON TABLE "public"."battles" TO "authenticated";
GRANT ALL ON TABLE "public"."battles" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_sync_state" TO "anon";
GRANT ALL ON TABLE "public"."catalog_sync_state" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_sync_state" TO "service_role";



GRANT ALL ON TABLE "public"."notebook_notes" TO "anon";
GRANT ALL ON TABLE "public"."notebook_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notebook_notes" TO "service_role";



GRANT ALL ON TABLE "public"."primers" TO "anon";
GRANT ALL ON TABLE "public"."primers" TO "authenticated";
GRANT ALL ON TABLE "public"."primers" TO "service_role";



GRANT ALL ON TABLE "public"."problem_events" TO "anon";
GRANT ALL ON TABLE "public"."problem_events" TO "authenticated";
GRANT ALL ON TABLE "public"."problem_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("username") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."content_impact" TO "anon";
GRANT ALL ON TABLE "public"."content_impact" TO "authenticated";
GRANT ALL ON TABLE "public"."content_impact" TO "service_role";



GRANT ALL ON TABLE "public"."contests" TO "anon";
GRANT ALL ON TABLE "public"."contests" TO "authenticated";
GRANT ALL ON TABLE "public"."contests" TO "service_role";



GRANT ALL ON TABLE "public"."custom_lists" TO "anon";
GRANT ALL ON TABLE "public"."custom_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_lists" TO "service_role";



GRANT ALL ON TABLE "public"."daily_battles" TO "anon";
GRANT ALL ON TABLE "public"."daily_battles" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_battles" TO "service_role";



GRANT ALL ON TABLE "public"."discussion_replies" TO "anon";
GRANT ALL ON TABLE "public"."discussion_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."discussion_replies" TO "service_role";



GRANT ALL ON TABLE "public"."discussions" TO "anon";
GRANT ALL ON TABLE "public"."discussions" TO "authenticated";
GRANT ALL ON TABLE "public"."discussions" TO "service_role";



GRANT ALL ON TABLE "public"."feature_triage" TO "anon";
GRANT ALL ON TABLE "public"."feature_triage" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_triage" TO "service_role";



GRANT ALL ON TABLE "public"."feed_reports" TO "anon";
GRANT ALL ON TABLE "public"."feed_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_reports" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."list_problems" TO "anon";
GRANT ALL ON TABLE "public"."list_problems" TO "authenticated";
GRANT ALL ON TABLE "public"."list_problems" TO "service_role";



GRANT ALL ON TABLE "public"."note_shares" TO "anon";
GRANT ALL ON TABLE "public"."note_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."note_shares" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."platform_posts" TO "anon";
GRANT ALL ON TABLE "public"."platform_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_posts" TO "service_role";



GRANT ALL ON TABLE "public"."problems" TO "anon";
GRANT ALL ON TABLE "public"."problems" TO "authenticated";
GRANT ALL ON TABLE "public"."problems" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_log" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_log" TO "service_role";



GRANT ALL ON TABLE "public"."review_queue" TO "anon";
GRANT ALL ON TABLE "public"."review_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."review_queue" TO "service_role";



GRANT ALL ON TABLE "public"."shared_resources" TO "anon";
GRANT ALL ON TABLE "public"."shared_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_resources" TO "service_role";



GRANT ALL ON TABLE "public"."squad_goals" TO "anon";
GRANT ALL ON TABLE "public"."squad_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_goals" TO "service_role";



GRANT ALL ON TABLE "public"."squad_members" TO "anon";
GRANT ALL ON TABLE "public"."squad_members" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_members" TO "service_role";



GRANT ALL ON TABLE "public"."squad_milestones" TO "anon";
GRANT ALL ON TABLE "public"."squad_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."squad_recaps" TO "anon";
GRANT ALL ON TABLE "public"."squad_recaps" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_recaps" TO "service_role";



GRANT ALL ON TABLE "public"."squad_referrals" TO "anon";
GRANT ALL ON TABLE "public"."squad_referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_referrals" TO "service_role";



GRANT ALL ON TABLE "public"."squad_seasons" TO "anon";
GRANT ALL ON TABLE "public"."squad_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."squad_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."squads" TO "anon";
GRANT ALL ON TABLE "public"."squads" TO "authenticated";
GRANT ALL ON TABLE "public"."squads" TO "service_role";



GRANT ALL ON TABLE "public"."stuck_replies" TO "anon";
GRANT ALL ON TABLE "public"."stuck_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."stuck_replies" TO "service_role";



GRANT ALL ON TABLE "public"."stuck_requests" TO "anon";
GRANT ALL ON TABLE "public"."stuck_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."stuck_requests" TO "service_role";



GRANT ALL ON TABLE "public"."suggestions" TO "anon";
GRANT ALL ON TABLE "public"."suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."sync_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."sync_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_stats" TO "anon";
GRANT ALL ON TABLE "public"."teacher_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_problem_status" TO "anon";
GRANT ALL ON TABLE "public"."user_problem_status" TO "authenticated";
GRANT ALL ON TABLE "public"."user_problem_status" TO "service_role";



GRANT ALL ON TABLE "public"."validation_observations" TO "anon";
GRANT ALL ON TABLE "public"."validation_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."validation_observations" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- ============================================================
-- Seed rows (appended after the schema-only dump, which carries no data).
-- All three are idempotent.
-- ============================================================

-- Curated roadmaps. Referenced by name in the sidebar, so the slugs are part of
-- the product's information architecture rather than arbitrary.
insert into public.custom_lists (slug, title, emoji, description, is_curated)
values
  ('neetcode-150', 'NeetCode 150', 'NeetCode', 'The premier curated roadmap covering all core coding interview patterns.', true),
  ('blind-75', 'Blind 75', 'Blind', 'The essential 75 classic interview questions for fast review.', true),
  ('striver-sde', 'Striver SDE Sheet', 'Striver', 'Comprehensive DSA sheet tailored for top-tier software engineering roles.', true)
on conflict (slug) do nothing;

-- ============================================================
-- SEED LIST PROBLEMS (real LeetCode slugs so Arena/POTD work)
-- ============================================================
do $$
declare
  v_neetcode uuid := (select id from public.custom_lists where slug = 'neetcode-150');
  v_blind uuid := (select id from public.custom_lists where slug = 'blind-75');
  v_striver uuid := (select id from public.custom_lists where slug = 'striver-sde');
begin
  insert into public.list_problems (list_id, title, title_slug, difficulty, category, order_index)
  values
    -- NeetCode 150 core set
    (v_neetcode, 'Two Sum', 'two-sum', 'Easy', 'Arrays & Hashing', 1),
    (v_neetcode, 'Valid Anagram', 'valid-anagram', 'Easy', 'Arrays & Hashing', 2),
    (v_neetcode, 'Contains Duplicate', 'contains-duplicate', 'Easy', 'Arrays & Hashing', 3),
    (v_neetcode, 'Group Anagrams', 'group-anagrams', 'Medium', 'Arrays & Hashing', 4),
    (v_neetcode, 'Top K Frequent Elements', 'top-k-frequent-elements', 'Medium', 'Arrays & Hashing', 5),
    (v_neetcode, 'Valid Parentheses', 'valid-parentheses', 'Easy', 'Stack', 6),
    (v_neetcode, 'Implement Queue using Stacks', 'implement-queue-using-stacks', 'Easy', 'Stack', 7),
    (v_neetcode, 'Evaluate Reverse Polish Notation', 'evaluate-reverse-polish-notation', 'Medium', 'Stack', 8),
    (v_neetcode, 'Generate Parentheses', 'generate-parentheses', 'Medium', 'Backtracking', 9),
    (v_neetcode, 'Word Search', 'word-search', 'Medium', 'Backtracking', 10),
    (v_neetcode, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 11),
    (v_neetcode, 'Clone Graph', 'clone-graph', 'Medium', 'Graphs', 12),
    (v_neetcode, 'Course Schedule', 'course-schedule', 'Medium', 'Graphs', 13),
    (v_neetcode, 'Pacific Atlantic Ocean Currents', 'pacific-atlantic-water-flow', 'Medium', 'Graphs', 14),
    (v_neetcode, 'Binary Tree Inorder Traversal', 'binary-tree-inorder-traversal', 'Easy', 'Trees', 15),
    (v_neetcode, 'Maximum Depth of Binary Tree', 'maximum-depth-of-binary-tree', 'Easy', 'Trees', 16),
    (v_neetcode, 'Invert Binary Tree', 'invert-binary-tree', 'Easy', 'Trees', 17),
    (v_neetcode, 'Binary Tree Level Order Traversal', 'binary-tree-level-order-traversal', 'Medium', 'Trees', 18),
    (v_neetcode, 'Lowest Common Ancestor of a BST', 'lowest-common-ancestor-of-a-binary-search-tree', 'Medium', 'Trees', 19),
    (v_neetcode, 'Validate Binary Search Tree', 'validate-binary-search-tree', 'Medium', 'Trees', 20),
    (v_neetcode, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 21),
    (v_neetcode, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 22),
    (v_neetcode, 'Linked List Cycle', 'linked-list-cycle', 'Easy', 'Linked List', 23),
    (v_neetcode, 'Reorder List', 'reorder-list', 'Medium', 'Linked List', 24),
    (v_neetcode, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 25),
    (v_neetcode, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 26),
    (v_neetcode, 'Find Minimum in Rotated Sorted Array', 'find-minimum-in-rotated-sorted-array', 'Medium', 'Binary Search', 27),
    (v_neetcode, 'Climbing Stairs', 'climbing-stairs', 'Easy', '1-D Dynamic Programming', 28),
    (v_neetcode, 'House Robber', 'house-robber', 'Medium', '1-D Dynamic Programming', 29),
    (v_neetcode, 'Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'Easy', '1-D Dynamic Programming', 30),
    (v_neetcode, 'Coin Change', 'coin-change', 'Medium', 'Dynamic Programming', 31),
    (v_neetcode, 'Longest Increasing Subsequence', 'longest-increasing-subsequence', 'Medium', 'Dynamic Programming', 32),
    (v_neetcode, 'Word Break', 'word-break', 'Medium', 'Dynamic Programming', 33),
    (v_neetcode, 'Sliding Window Maximum', 'sliding-window-maximum', 'Hard', 'Sliding Window', 34),
    (v_neetcode, 'Longest Substring Without Repeating Characters', 'longest-substring-without-repeating-characters', 'Medium', 'Sliding Window', 35),
    (v_neetcode, 'Minimum Window Substring', 'minimum-window-substring', 'Hard', 'Sliding Window', 36),
    (v_neetcode, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 37),
    (v_neetcode, 'Insert Interval', 'insert-interval', 'Medium', 'Intervals', 38),
    (v_neetcode, 'Meeting Rooms', 'meeting-rooms', 'Easy', 'Intervals', 39),
    (v_neetcode, '3Sum', '3sum', 'Medium', 'Two Pointers', 40),
    (v_neetcode, 'Valid Palindrome', 'valid-palindrome', 'Easy', 'Two Pointers', 41),
    (v_neetcode, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 42),
    (v_neetcode, 'Container With Most Water', 'container-with-most-water', 'Medium', 'Two Pointers', 43),
    (v_neetcode, 'Product of Array Except Self', 'product-of-array-except-self', 'Medium', 'Arrays & Hashing', 44),
    (v_neetcode, 'LRU Cache', 'lru-cache', 'Medium', 'Design', 45),
    (v_neetcode, 'Implement Trie Prefix Tree', 'implement-trie-prefix-tree', 'Medium', 'Design', 46),
    (v_neetcode, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 47),
    (v_neetcode, 'Serialize and Deserialize Binary Tree', 'serialize-and-deserialize-binary-tree', 'Hard', 'Trees', 48),
    (v_neetcode, 'Subarray Sum Equals K', 'subarray-sum-equals-k', 'Medium', 'Arrays & Hashing', 49),
    -- Blind 75 essential set
    (v_blind, 'Two Sum', 'two-sum', 'Easy', 'Arrays & Hashing', 1),
    (v_blind, 'Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'Easy', 'Dynamic Programming', 2),
    (v_blind, 'Valid Parentheses', 'valid-parentheses', 'Easy', 'Stack', 3),
    (v_blind, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 4),
    (v_blind, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 5),
    (v_blind, 'Maximum Depth of Binary Tree', 'maximum-depth-of-binary-tree', 'Easy', 'Trees', 6),
    (v_blind, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 7),
    (v_blind, 'Course Schedule', 'course-schedule', 'Medium', 'Graphs', 8),
    (v_blind, '3Sum', '3sum', 'Medium', 'Two Pointers', 9),
    (v_blind, 'Container With Most Water', 'container-with-most-water', 'Medium', 'Two Pointers', 10),
    (v_blind, 'Longest Substring Without Repeating Characters', 'longest-substring-without-repeating-characters', 'Medium', 'Sliding Window', 11),
    (v_blind, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 12),
    (v_blind, 'Climbing Stairs', 'climbing-stairs', 'Easy', 'Dynamic Programming', 13),
    (v_blind, 'Word Break', 'word-break', 'Medium', 'Dynamic Programming', 14),
    (v_blind, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 15),
    (v_blind, 'Lru Cache', 'lru-cache', 'Medium', 'Design', 16),
    (v_blind, 'Top K Frequent Elements', 'top-k-frequent-elements', 'Medium', 'Arrays & Hashing', 17),
    (v_blind, 'Group Anagrams', 'group-anagrams', 'Medium', 'Arrays & Hashing', 18),
    (v_blind, 'Generate Parentheses', 'generate-parentheses', 'Medium', 'Backtracking', 19),
    (v_blind, 'Word Search', 'word-search', 'Medium', 'Backtracking', 20),
    (v_blind, 'Clone Graph', 'clone-graph', 'Medium', 'Graphs', 21),
    (v_blind, 'Validate Binary Search Tree', 'validate-binary-search-tree', 'Medium', 'Trees', 22),
    (v_blind, 'Binary Tree Level Order Traversal', 'binary-tree-level-order-traversal', 'Medium', 'Trees', 23),
    (v_blind, 'Lowest Common Ancestor of a BST', 'lowest-common-ancestor-of-a-binary-search-tree', 'Medium', 'Trees', 24),
    (v_blind, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 25),
    (v_blind, 'Linked List Cycle', 'linked-list-cycle', 'Easy', 'Linked List', 26),
    (v_blind, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 27),
    (v_blind, 'Meeting Rooms', 'meeting-rooms', 'Easy', 'Intervals', 28),
    (v_blind, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 29),
    (v_blind, 'Product of Array Except Self', 'product-of-array-except-self', 'Medium', 'Arrays & Hashing', 30),
    (v_blind, 'Minimum Window Substring', 'minimum-window-substring', 'Hard', 'Sliding Window', 31),
    -- Striver SDE Sheet core set
    (v_striver, 'Two Sum', 'two-sum', 'Easy', 'Arrays', 1),
    (v_striver, 'Sort an Array', 'sort-an-array', 'Medium', 'Arrays', 2),
    (v_striver, 'Kadanes Algorithm', 'maximum-subarray', 'Medium', 'Arrays', 3),
    (v_striver, 'Next Permutation', 'next-permutation', 'Medium', 'Arrays', 4),
    (v_striver, 'Set Matrix Zeroes', 'set-matrix-zeroes', 'Medium', 'Arrays', 5),
    (v_striver, 'Pascal Triangle', 'pascals-triangle', 'Easy', 'Arrays', 6),
    (v_striver, 'Majority Element', 'majority-element', 'Easy', 'Arrays', 7),
    (v_striver, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 8),
    (v_striver, 'Detect Loop in Linked List', 'linked-list-cycle-ii', 'Medium', 'Linked List', 9),
    (v_striver, 'Flatten a Linked List', 'flatten-a-multilevel-doubly-linked-list', 'Medium', 'Linked List', 10),
    (v_striver, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 11),
    (v_striver, 'LCA of Binary Tree', 'lowest-common-ancestor-of-a-binary-tree', 'Medium', 'Trees', 12),
    (v_striver, 'Diameter of Binary Tree', 'diameter-of-binary-tree', 'Easy', 'Trees', 13),
    (v_striver, 'Binary Tree Zigzag Level Order Traversal', 'binary-tree-zigzag-level-order-traversal', 'Medium', 'Trees', 14),
    (v_striver, 'Serialize and Deserialize Binary Tree', 'serialize-and-deserialize-binary-tree', 'Hard', 'Trees', 15),
    (v_striver, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 16),
    (v_striver, 'Rotten Oranges', 'rotting-oranges', 'Medium', 'Graphs', 17),
    (v_striver, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 18),
    (v_striver, 'Dijkstra Shortest Path', 'network-delay-time', 'Medium', 'Graphs', 19),
    (v_striver, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 20),
    (v_striver, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 21),
    (v_striver, 'Koko Eating Bananas', 'koko-eating-bananas', 'Medium', 'Binary Search', 22),
    (v_striver, 'Climbing Stairs', 'climbing-stairs', 'Easy', 'Dynamic Programming', 23),
    (v_striver, '0 1 Knapsack', 'partition-equal-subset-sum', 'Medium', 'Dynamic Programming', 24),
    (v_striver, 'Longest Common Subsequence', 'longest-common-subsequence', 'Medium', 'Dynamic Programming', 25),
    (v_striver, 'Edit Distance', 'edit-distance', 'Hard', 'Dynamic Programming', 26),
    (v_striver, 'Subset Sum', 'target-sum', 'Medium', 'Dynamic Programming', 27),
    (v_striver, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 28),
    (v_striver, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 29),
    (v_striver, 'N Meetings in One Room', 'maximum-number-of-events-that-can-be-attended', 'Medium', 'Intervals', 30),
    (v_striver, 'Implement Trie', 'implement-trie-prefix-tree', 'Medium', 'Design', 31),
    (v_striver, 'Design a Stack with getMin', 'min-stack', 'Easy', 'Design', 32)
  on conflict do nothing;
end $$;

-- ============================================================
-- FULL LEETCODE CATALOG (synced from LeetCode GraphQL)
-- ============================================================
create table if not exists public.problems (
  title_slug text primary key,
  title text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  question_id text not null,
  paid_only boolean default false,
  topics text[] not null default '{}',
  updated_at timestamp with time zone default now()
);

create index if not exists problems_difficulty_idx on public.problems (difficulty);
create index if not exists problems_topics_gin_idx on public.problems using gin (topics);

alter table public.problems enable row level security;
drop policy if exists "Allow public read access for problems" on public.problems;
drop policy if exists "Allow public read access for problems" on public.problems;
create policy "Allow public read access for problems" on public.problems for select using (true);
-- Writes happen only via the service-role client / server routes (no public INSERT policy).

-- Catalog sync bookkeeping (single row)
create table if not exists public.catalog_sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamp with time zone default now(),
  total_count int default 0
);
-- last_synced_at is NOT NULL with no default, so it has to be supplied. The
-- older hand-written schema gave it one, which is why this seed worked then
-- and fails now; a seed statement copied forward without rechecking the table
-- is exactly the kind of drift a generated schema is supposed to prevent.
insert into public.catalog_sync_state (id, total_count, last_synced_at)
values (1, 0, now()) on conflict (id) do nothing;

-- Single-row bookkeeping table the catalog sync writes to.
-- last_synced_at is NOT NULL with no default, so it has to be supplied. The
-- older hand-written schema gave it one, which is why this seed worked then
-- and fails now; a seed statement copied forward without rechecking the table
-- is exactly the kind of drift a generated schema is supposed to prevent.
insert into public.catalog_sync_state (id, total_count, last_synced_at)
values (1, 0, now()) on conflict (id) do nothing;

-- Backfill evidence events for rows promoted before problem_events existed, so
-- members whose LeetCode history predates the event log are not shown an empty
-- history. Guarded by not exists, so re-running adds nothing.
insert into public.problem_events (user_id, problem_slug, kind, metadata, created_at)
select ups.user_id, ups.problem_slug, 'solved',
       jsonb_build_object('source', 'leetcode'), coalesce(ups.solved_at, now())
from public.user_problem_status ups
where ups.status = 'solved'
  and not exists (
    select 1 from public.problem_events e
    where e.user_id = ups.user_id
      and e.problem_slug = ups.problem_slug
      and e.kind = 'solved'
  );
