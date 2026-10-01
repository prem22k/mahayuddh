-- Phase 0-2 gap repair (audit 2026-10-01). Closes schema holes found in the
-- Phase 0-2 review. Additive + idempotent only: no destructive changes.
--
-- Fixes, in plan order:
--   Step  6  daily_battles cache (one row/user/day, stable pick across refreshes)
--   Step  8  mark_solved_from_leetcode now appends a problem_events row, so
--            LeetCode-evidenced solves actually appear on the timeline
--   Step 10  suggestions.message (rename of `note`), accepted_at, reminded_at
--   Step 11  feed_events.squad_id on delete SET NULL, not CASCADE (§64: deleting a
--            squad must not erase its activity history)
--   Step 14  review_queue materialized on battle end (failed -> due, solved -> clear)
--   Step  2  analytics_events sink (funnel becomes queryable)
--   Step 23  notifications table (action-oriented, low noise)
--   Step 12/13 fork_count on primers + shared_resources (Loop C counters, §47)
--   Step  5  squad_members.active
--   Step  7  battles.challenge_id (accepted challenge attached to the session)
--   Step  0  lock_suggestion_parties trigger actually created (migration 20261001000003
--            replaced the function but never issued CREATE TRIGGER)

-- ---------------------------------------------------------------------------
-- Step 7: attach the challenge being answered to the battle session
-- ---------------------------------------------------------------------------
alter table public.battles
  add column if not exists challenge_id uuid references public.suggestions(id) on delete set null;
create index if not exists battles_challenge_idx on public.battles (challenge_id) where challenge_id is not null;

-- ---------------------------------------------------------------------------
-- Step 10: challenge terms. `note` is renamed to `message` (plan §Step 10).
-- ---------------------------------------------------------------------------
alter table public.suggestions add column if not exists message text;
update public.suggestions set message = note where message is null and note is not null;
alter table public.suggestions add column if not exists accepted_at timestamp with time zone;
alter table public.suggestions add column if not exists reminded_at timestamp with time zone;

-- Reminder throttle: at most one remind per 24h per challenge.
create or replace function public.suggestion_remind_allowed(p_suggestion_id uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suggestions s
    where s.id = p_suggestion_id
      and (s.from_user = p_actor or s.to_user = p_actor)
      and (s.reminded_at is null or s.reminded_at < now() - interval '24 hours')
  );
$$;
revoke all on function public.suggestion_remind_allowed(uuid, uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 0 hazard: the immutability trigger was never created on a migration-only chain.
-- ---------------------------------------------------------------------------
drop trigger if exists lock_suggestion_parties on public.suggestions;
create trigger lock_suggestion_parties
  before update on public.suggestions
  for each row execute function public.lock_suggestion_parties();

-- ---------------------------------------------------------------------------
-- Step 5: squad_members.active (membership flag independent of the row existing)
-- ---------------------------------------------------------------------------
alter table public.squad_members
  add column if not exists active boolean default true not null;
update public.squad_members set active = true where active is false;

-- ---------------------------------------------------------------------------
-- Step 6: daily_battles cache — one row per user per day, so the pick is stable
-- even if the sheet's problem list changes mid-day (deterministic + persisted).
-- ---------------------------------------------------------------------------
create table if not exists public.daily_battles (
  user_id uuid references public.profiles(id) on delete cascade not null,
  battle_date date not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  reason_json jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  primary key (user_id, battle_date)
);

alter table public.daily_battles enable row level security;
drop policy if exists "Users read own daily battles" on public.daily_battles;
create policy "Users read own daily battles" on public.daily_battles
  for select using ((select auth.uid()) = user_id);
-- Writes go through the service-role API route only: a client must not be able to
-- re-roll today's battle by inserting a different slug.

-- ---------------------------------------------------------------------------
-- Step 11: do not erase squad activity history when a squad is deleted (§64).
-- ---------------------------------------------------------------------------
alter table public.feed_events
  drop constraint if exists feed_events_squad_id_fkey;
alter table public.feed_events
  add constraint feed_events_squad_id_fkey
  foreign key (squad_id) references public.squads(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Step 8: LeetCode evidence must produce a history row. Without this, a
-- LeetCode-promoted solve never appears on the timeline and the "LeetCode
-- evidence" badge is unreachable.
-- ---------------------------------------------------------------------------
create or replace function public.mark_solved_from_leetcode(p_user_id uuid, p_slugs text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
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
revoke all on function public.mark_solved_from_leetcode(uuid, text[]) from anon, authenticated;

-- Backfill: existing LeetCode-promoted rows get their evidence event once.
insert into public.problem_events (user_id, problem_slug, kind, metadata, created_at)
select ups.user_id, ups.problem_slug, 'solved', jsonb_build_object('source', 'leetcode'), coalesce(ups.solved_at, now())
from public.user_problem_status ups
where ups.status = 'solved'
  and not exists (
    select 1 from public.problem_events e
    where e.user_id = ups.user_id and e.problem_slug = ups.problem_slug and e.kind = 'solved'
  );

-- ---------------------------------------------------------------------------
-- Step 14: review_queue materialized on battle end (plan: "materialized on battle
-- end via trigger/function, cleared on solve"). Previously it was only reconciled
-- when the user happened to open the Practice hub, so a failed problem could sit
-- unreviewed indefinitely.
-- ---------------------------------------------------------------------------
create or replace function public.sync_review_queue_from_battle()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists sync_review_queue_on_battle_end on public.battles;
create trigger sync_review_queue_on_battle_end
  after update on public.battles
  for each row
  when (old.outcome is distinct from new.outcome
        and new.outcome in ('failed', 'solved'))
  execute function public.sync_review_queue_from_battle();

-- ---------------------------------------------------------------------------
-- Step 12/13: fork counters (Loop C, §47). Maintained by trigger so no client
-- write can drift them.
-- ---------------------------------------------------------------------------
alter table public.primers add column if not exists fork_count int default 0 not null;
alter table public.shared_resources add column if not exists fork_count int default 0 not null;

create or replace function public.refresh_fork_count(p_source_table text, p_source_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
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

-- Notebook forks target either a primer, a vault resource, or an approach. Only
-- the first two are counter-backed (approaches get their own Step 16 treatment).
create or replace function public.refresh_note_fork_count()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists refresh_fork_count_on_note_change on public.notebook_notes;
create trigger refresh_fork_count_on_note_change
  after insert or delete on public.notebook_notes
  for each row execute function public.refresh_note_fork_count();

-- Backfill existing forks.
update public.primers p set fork_count = (select count(*) from public.notebook_notes n where n.fork_of = p.id);
update public.shared_resources r set fork_count = (select count(*) from public.notebook_notes n where n.fork_of = r.id);

-- ---------------------------------------------------------------------------
-- Step 2: analytics_events sink. Private per-user rows; the funnel query runs
-- server-side with the service key, so no client can read aggregate behaviour.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event text not null check (event ~ '^[a-z0-9_]{1,60}$'),
  props jsonb default '{}'::jsonb not null,
  occurred_at timestamp with time zone default now() not null
);
create index if not exists analytics_events_event_time_idx on public.analytics_events (event, occurred_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, occurred_at desc);

alter table public.analytics_events enable row level security;
drop policy if exists "Users append own analytics" on public.analytics_events;
create policy "Users append own analytics" on public.analytics_events
  for insert with check ((select auth.uid()) = user_id);
-- Deliberately no SELECT policy: behaviour data is not readable by any client.

-- ---------------------------------------------------------------------------
-- Step 23: notifications. Action-oriented with deep links, low noise by default
-- (see lib/data/notifications.ts for the batching policy).
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  kind text check (kind in ('challenge', 'challenge_completed', 'goal', 'revenge', 'recap', 'contest')) not null,
  title text not null check (char_length(title) between 1 and 140),
  body text check (body is null or char_length(body) <= 500),
  deep_link text check (deep_link is null or deep_link ~ '^/[A-Za-z0-9/_?=&%-]*$'),
  actor_id uuid references public.profiles(id) on delete set null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select using ((select auth.uid()) = user_id);
create policy "Users mark own notifications read" on public.notifications
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own notifications" on public.notifications
  for delete using ((select auth.uid()) = user_id);
-- No INSERT policy: notifications are raised by app logic, never by the client.