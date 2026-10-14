-- Step 26 — Loop C: knowledge attribution (Bible §47, §56 Loop C).
--
-- §56's Loop C is "solve → read somebody's approach or primer → adopt it → solve
-- more". Step 13 built the fork; nothing ever closed the loop, because there
-- was no way for an author to see that their writing changed anybody's
-- behaviour. Step 22 counted forks in teacher_stats but only from primers and
-- shared_resources, and its "completions" column was challenge completions —
-- a different thing entirely.
--
-- Three things here, and one bug fix.
--
-- BUG: approaches.fork_count does not exist, and Step 22's profile reads
-- select it. Every real /u/[username] page therefore 500s. It shipped in fb1ad8a
-- and survived because no browser test ever loaded a real profile — the only
-- profile page exercised was a 404 for a username that does not exist, which
-- short-circuits before the query.

alter table public.approaches add column if not exists fork_count int default 0 not null;

-- ── What kind of thing was forked ────────────────────────────────────────────
-- notebook_notes.fork_of is a bare uuid with no foreign key, because it can
-- point at an approach, a primer or a vault item. That made the chain
-- ambiguous: the same id could in principle be any of the three, and the
-- trigger could not tell which counter to increment.
--
-- fork_of_type disambiguates. Existing rows are backfilled by matching against
-- each table, and anything unmatched is left null rather than guessed at.
alter table public.notebook_notes add column if not exists fork_of_type text;

update public.notebook_notes n
set fork_of_type = case
  when exists (select 1 from public.approaches a where a.id = n.fork_of) then 'approach'
  when exists (select 1 from public.primers p where p.id = n.fork_of) then 'primer'
  when exists (select 1 from public.shared_resources r where r.id = n.fork_of) then 'resource'
end
where n.fork_of is not null and n.fork_of_type is null;

alter table public.notebook_notes
  add constraint notebook_notes_fork_of_type_check
  check (fork_of_type is null or fork_of_type in ('approach', 'primer', 'resource'));

comment on column public.notebook_notes.fork_of_type is
  'Which kind of object this note was copied from. Disambiguates the bare fork_of uuid, which can point at approaches, primers or shared_resources.';

-- ── Fork counters, maintained by trigger ─────────────────────────────────────
-- So no client write can drift them, and a deleted copy decrements.
create or replace function public.refresh_fork_counts_for_note()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists refresh_fork_counts_for_note on public.notebook_notes;
create trigger refresh_fork_counts_for_note
  after insert or update or delete on public.notebook_notes
  for each row execute function public.refresh_fork_counts_for_note();

-- Backfill every existing counter, not just the touched rows: the migration is
-- where the truth is established, since no client has ever been able to write
-- these.
update public.approaches a
set fork_count = (select count(*) from public.notebook_notes n where n.fork_of = a.id);
update public.primers p
set fork_count = (select count(*) from public.notebook_notes n where n.fork_of = p.id);
update public.shared_resources r
set fork_count = (select count(*) from public.notebook_notes n where n.fork_of = r.id);

-- ── Impact: "your primer helped N developers solve X" ─────────────────────────
-- A completion is NOT a fork. It is a fork followed by an actual solve of one of
-- the problems the object points at, within 30 days.
--
-- The window matters: without it, a developer who copied a primer in March and
-- solved the problem in December would count forever, and the author would be
-- told their primer caused it. Causal claims need a bounded claim.
--
-- Deliberately a count of (fork, solve) pairs per forker, capped at one per
-- person per problem, so one enthusiastic copier cannot inflate the number.
create or replace view public.content_impact as
with fork_events as (
  select
    n.id as fork_id,
    n.owner_id as forker_id,
    n.fork_of as source_id,
    n.fork_of_type as source_type,
    n.created_at as forked_at
  from public.notebook_notes n
  where n.fork_of is not null
),
completion_windows as (
  -- Starter problems a primer points at.
  select f.fork_id, f.forker_id, f.source_id, f.source_type, f.forked_at,
         p.slug as problem_slug
  from fork_events f
  left join public.primers pr on pr.id = f.source_id and f.source_type = 'primer'
  cross join lateral unnest(coalesce(pr.starter_slugs, '{}'::text[])) as p(slug)

  union all

  -- An approach is about one problem, so that is the completion.
  select f.fork_id, f.forker_id, f.source_id, f.source_type, f.forked_at, a.problem_slug
  from fork_events f
  join public.approaches a on a.id = f.source_id and f.source_type = 'approach'

  -- A vault resource has no completion branch, on purpose:
  -- shared_resources has no problem link, so there is nothing for a copier to
  -- go and solve. Counting "they copied it" as an impact would inflate the
  -- number with forks, which is what the fork count is already for.
)
select
  c.source_id,
  c.source_type,
  c.forker_id,
  p.username as forker_username,
  c.problem_slug,
  c.forked_at,
  -- The solve that completed the loop, if it happened inside the window.
  (
    select min(e.created_at)
    from public.problem_events e
    where e.user_id = c.forker_id
      and e.problem_slug = c.problem_slug
      and e.kind in ('solved', 'revisited')
      and e.created_at >= c.forked_at
      and e.created_at <= c.forked_at + interval '30 days'
  ) as solved_at
from completion_windows c
join public.profiles p on p.id = c.forker_id
where c.problem_slug is not null;

comment on view public.content_impact is
  '§56 Loop C: one row per (fork, target problem). solved_at is null unless the forker solved that problem within 30 days of copying, so the attribution is a bounded claim rather than a permanent one.';

-- ── The author-facing rollup ─────────────────────────────────────────────────
create or replace function public.my_content_impact()
returns table (
  source_type text,
  source_id uuid,
  label text,
  forks int,
  completions int,
  headline text
)
language sql stable security definer set search_path = public as $$
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

comment on function public.my_content_impact() is
  '§26 Loop C author view. Only objects somebody actually copied appear, so the panel cannot list a wall of zeroes.';

grant execute on function public.my_content_impact() to authenticated;