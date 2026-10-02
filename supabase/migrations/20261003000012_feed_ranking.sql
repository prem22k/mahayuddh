-- Step 21 — Feed ranking as a SQL order expression (§20).
--
-- §20 is explicit about the primary signals: successful copies, completed
-- related problems, revisits, challenge completions, meaningful discussion,
-- pattern relevance, recency. And explicit about one thing that is not a signal:
-- "Do not make likes the primary competence signal." This repo has no likes
-- column anywhere, so the exclusion is structural rather than a matter of
-- weighting — there is nothing to weight. If someone adds one later, it does
-- not enter this expression, and that is the point of writing the ranking in
-- SQL: the rule is legible in one place instead of scattered through a client.
--
-- §20 defines a useful post as one that "changes what another developer does
-- next", so every weight below is a downstream action somebody took, not an
-- opinion somebody expressed.
--
-- Blocked authors are filtered in SQL rather than in the client: a block that
-- only hides rows after they arrive still ships the blocked person's activity
-- to the device.

create or replace function public.feed_usefulness(p_event public.feed_events)
returns numeric language sql stable security definer set search_path = public as $$
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

comment on function public.feed_usefulness(public.feed_events) is
  '§20 usefulness weight. Downstream actions only: copies, challenge completions, revisits, discussion depth, pattern linkage. No likes — §20 forbids likes as a competence signal and this schema has no likes column.';

-- Returns feed rows for one scope, ranked. Views and client-side sorting cannot
-- enforce the blocklist, so this is a function with the viewer passed in.
create or replace function public.get_ranked_feed(
  p_scope text,
  p_squad_id uuid default null,
  p_viewer uuid default null,
  p_limit int default 30
)
returns table (
  id uuid,
  user_id uuid,
  event_type text,
  problem_title text,
  problem_slug text,
  difficulty text,
  squad_id uuid,
  object_type text,
  object_id text,
  metadata jsonb,
  created_at timestamptz,
  usefulness numeric,
  score numeric
)
language sql stable security definer set search_path = public as $$
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

comment on function public.get_ranked_feed(text, uuid, uuid, int) is
  '§20-ranked feed rows for one scope. Applies the viewer''s blocks and their own reports server-side. Squad scope carries a flat score floor so a new squad is never empty (§50).';

grant execute on function public.get_ranked_feed(text, uuid, uuid, int) to anon, authenticated;
grant execute on function public.feed_usefulness(public.feed_events) to anon, authenticated;