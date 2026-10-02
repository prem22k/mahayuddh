-- Step 22 — teacher_stats: reputation as dimensions, never a score (Bible §22).
--
-- §22 is unusually blunt: "Do not compress these immediately into a single
-- 'skill score.' A single score creates false precision and invites gaming."
--
-- That instruction is honoured structurally, not by convention. This view has
-- no total column, no weighted index, and no rank derived from these numbers.
-- The five dimensions §22 names each get their own raw count and their own
-- definition, and nothing adds them up. If somebody later wants a leaderboard
-- ordered by "reputation", they will find there is no single number to order
-- by — which is the point.
--
-- The pattern page teacher list (Step 22) therefore sorts by a real downstream
-- signal, forks and completions, not by these numbers collapsed together.

create or replace view public.teacher_stats as
with solve_counts as (
  select
    e.user_id,
    count(*) filter (where e.kind in ('solved', 'revisited')) as logged_solves,
    -- §22 "verified solves". A solve backed by LeetCode evidence, which is the
    -- only kind this codebase can check. Self-reported solves are counted
    -- separately rather than folded in and quietly trusted.
    count(*) filter (
      where e.kind in ('solved', 'revisited')
        and coalesce(e.metadata->>'source', '') = 'leetcode'
    ) as verified_solves,
    count(distinct date_trunc('day', e.created_at)) as active_days
  from public.problem_events e
  group by e.user_id
),
sessions as (
  select user_id, count(*) as battles, count(*) filter (where outcome = 'solved') as battles_won
  from public.battles
  group by user_id
),
teaching as (
  select user_id, count(*) as approaches, count(distinct pattern) as patterns_taught
  from public.approaches
  where visibility = 'public'
  group by user_id
),
primer_counts as (
  select p.author_id as user_id, count(*) as primers
  from public.primers p
  where p.visibility = 'public' and p.author_id is not null
  group by p.author_id
),
-- Primer forks. The plan mentions a primers.fork_count column; it was never
-- actually created, and a counter would be wrong the moment somebody deleted a
-- copy. A primer copy is a notebook_note whose fork_of is the primer id
-- (lib/data/notebook.ts copyPrimerToNotebook), so the copies are counted from
-- the rows that exist.
primer_forks as (
  select pr.author_id as user_id, count(*) as primer_forks
  from public.notebook_notes n
  join public.primers pr on pr.id = n.fork_of
  where pr.author_id is not null
  group by pr.author_id
),
-- Helpfulness (§22): challenges that got finished. "Accepted / used hints and
-- discussions" — this counts the challenge side because that is the one with a
-- terminal state we can verify, and counts discussions as a separate number.
challenges as (
  select
    from_user as user_id,
    count(*) filter (where status = 'completed') as challenge_completions,
    count(*) as challenges_sent
  from public.suggestions
  group by from_user
),
help_discussions as (
  select
    d.author_id as user_id,
    count(*) as discussions,
    coalesce(sum(r.n), 0) as replies_received
  from public.discussions d
  left join lateral (
    select count(*) as n from public.discussion_replies r
    where r.discussion_id = d.id and r.deleted_at is null
  ) r on true
  where d.deleted_at is null
  group by d.author_id
),
impact as (
  -- Forks of this person's own public notes. Note forks and primer forks are
  -- kept apart because they are different acts: copying a note means taking
  -- someone's specifics, copying a primer means taking their pattern.
  select
    n.owner_id as user_id,
    count(*) as note_forks
  from public.notebook_notes n
  where n.fork_of is not null
    and n.visibility = 'public'
    and exists (select 1 from public.notebook_notes o where o.id = n.fork_of)
  group by n.owner_id
),
pattern_list as (
  select user_id, array_agg(distinct p) as frequent_patterns
  from (
    select user_id, pattern as p from public.approaches where visibility = 'public' and pattern is not null
    union
    select dd.author_id as user_id, unnest(dd.pattern_tags) as p
    from public.discussions dd where dd.deleted_at is null
    union
    select author_id, pattern from public.primers where visibility = 'public'
  ) s
  where p is not null and p <> ''
  group by user_id
)
select
  p.id as user_id,
  p.username,
  coalesce(s.logged_solves, 0) as logged_solves,
  coalesce(s.verified_solves, 0) as verified_solves,
  coalesce(s.active_days, 0) as active_days,
  coalesce(ss.battles, 0) as battles,
  coalesce(ss.battles_won, 0) as battles_won,
  coalesce(t.approaches, 0) as approaches,
  coalesce(t.patterns_taught, 0) as patterns_taught,
  coalesce(pr.primers, 0) as primers,
  coalesce(ch.challenge_completions, 0) as challenge_completions,
  coalesce(ch.challenges_sent, 0) as challenges_sent,
  coalesce(hd.discussions, 0) as discussions,
  coalesce(hd.replies_received, 0) as replies_received,
  coalesce(i.note_forks, 0) as note_forks,
  coalesce(pf.primer_forks, 0) as primer_forks,
  coalesce(pl.frequent_patterns, '{}'::text[]) as frequent_patterns,
  -- Improvement history (§22's "improvement"), as a count of genuine
  -- before/after pairs rather than a slope or an average.
  coalesce(imp.improvements, 0) as improvements
from public.profiles p
left join solve_counts s on s.user_id = p.id
left join sessions ss on ss.user_id = p.id
left join teaching t on t.user_id = p.id
left join primer_counts pr on pr.user_id = p.id
left join primer_forks pf on pf.user_id = p.id
left join challenges ch on ch.user_id = p.id
left join help_discussions hd on hd.user_id = p.id
left join impact i on i.user_id = p.id
left join pattern_list pl on pl.user_id = p.id
left join lateral (
  -- Same rule the recap uses: same person, same problem, two solves, both
  -- durations recorded. Without both times there is no improvement to count.
  select count(*) as improvements
  from (
    select e.problem_slug
    from public.problem_events e
    where e.user_id = p.id
      and e.kind in ('solved', 'revisited')
      and e.duration_sec is not null
    group by e.problem_slug
    having count(*) >= 2
  ) x
) imp on true;

comment on view public.teacher_stats is
  '§22 reputation as five dimensions with no total. Verified solves / Teaching / Helpfulness / Consistency / Impact. There is deliberately no aggregate column and no rank — a single score creates false precision and invites gaming.';

grant select on public.teacher_stats to anon, authenticated;

-- ── Pattern-page teacher discovery ────────────────────────────────────────────
-- Step 22: "People who teach it", sorted by forks/completions, NOT followers
-- and NOT a collapsed reputation number. A mentor list ordered by popularity is
-- the opposite of what §21 asks for.
create or replace function public.teachers_for_pattern(p_pattern text, p_limit int default 8)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  approaches int,
  primers int,
  note_forks int,
  primer_forks int,
  challenge_completions int
)
language sql stable security definer set search_path = public as $$
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

comment on function public.teachers_for_pattern(text, int) is
  '§21/§22 teacher discovery for a pattern. Ordered by forks and completed challenges — downstream use, not followers and not a collapsed score.';

grant execute on function public.teachers_for_pattern(text, int) to anon, authenticated;