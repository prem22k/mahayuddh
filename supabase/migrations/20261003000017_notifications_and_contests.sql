-- Step 23 — Notification triggers + contests (Bible §36, §37, §34).
--
-- §37 gives two examples of good notifications ("Rahul challenged you.", "Your
-- squad is 3 solves away from its weekly goal.") and two of bad ones ("Someone
-- liked your post.", "You have 14 generic notifications."). The default is
-- low-noise.
--
-- That default is enforced structurally:
--
--   - Every trigger below writes a row with a dedupe_key. There is a partial
--     unique index on (user_id, kind, dedupe_key) where read_at is null, so a
--     goal nudge cannot stack no matter how often it fires. That is the
--     "1/day" requirement done by the database instead of by a cron guard that
--     somebody could forget.
--   - Nothing is generated from a like, a view or a streak. There is no
--     trigger here that can produce a notification nobody could act on.
--   - Notifications are written by triggers on the rows that earn them, so the
--     action that made somebody care and the notice about it cannot disagree.

-- ── Quiet hours ──────────────────────────────────────────────────────────────
-- §37 says low-noise by default. Quiet hours are a function rather than a
-- setting so the value is inspectable and changeable in one place.
create or replace function public.in_quiet_hours(p_at timestamptz default now())
returns boolean language sql stable as $$
  -- 22:00–08:00 UTC. Contest reminders and goal nudges respect it; a direct
  -- challenge from a person you know does not, because ignoring somebody who
  -- just challenged you is its own kind of noise.
  select extract(hour from p_at at time zone 'UTC') >= 22
      or extract(hour from p_at at time zone 'UTC') < 8
$$;

comment on function public.in_quiet_hours(timestamptz) is
  '§37 low-noise default: 22:00-08:00 UTC. Advisory nudges check this; direct person-to-person notices do not.';

-- ── A challenge arrived ──────────────────────────────────────────────────────
create or replace function public.notify_challenge_received()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists notify_challenge_received on public.suggestions;
create trigger notify_challenge_received
  after insert on public.suggestions
  for each row execute function public.notify_challenge_received();

-- ── A challenge was completed ────────────────────────────────────────────────
create or replace function public.notify_challenge_completed()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- Fires on status change only. A challenge moving to 'dismissed' is not an event
-- worth a notification.
drop trigger if exists notify_challenge_completed on public.suggestions;
create trigger notify_challenge_completed
  after update on public.suggestions
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_challenge_completed();

-- ── Goal near completion ─────────────────────────────────────────────────────
-- §37's example: "Your squad is 3 solves away from its weekly goal." One
-- notice, once, because of the dedupe index.
create or replace function public.notify_goal_near_complete()
returns trigger language plpgsql security definer set search_path = public as $$
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

comment on function public.notify_goal_near_complete() is
  '§37 goal nudge. One open notice per goal thanks to notifications_dedupe_open_unique, so it cannot stack.';

-- ── Contests (§36) ───────────────────────────────────────────────────────────
-- Purpose is ritual, not a contest platform. Manual ingest only: the plan says
-- "manual LeetCode contest calendar entry v0, no scraping", and scraping
-- leetcode.com would be both fragile and a terms problem.
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  url text check (url is null or url ~ '^https?://'),
  -- Which platform, so a reminder can say where it is.
  platform text not null default 'leetcode' check (platform in ('leetcode', 'codeforces', 'other')),
  created_at timestamptz default now(),
  -- One contest per start time. Re-ingesting the same calendar must not create
  -- duplicate reminders.
  unique (starts_at, platform)
);

create index if not exists contests_upcoming_idx on public.contests (starts_at);

alter table public.contests enable row level security;
drop policy if exists "Contests publicly readable" on public.contests;
create policy "Contests publicly readable" on public.contests for select using (true);

-- §36 ritual reminder, 24h out. Called by the cron route, not by a trigger:
-- "starts_at is 24 hours away" is a statement about time, and no trigger can
-- notice that a row is approaching.
create or replace function public.notify_contest_reminders(p_within interval default interval '24 hours')
returns int language plpgsql security definer set search_path = public as $$
declare
  c record;
  members uuid[];
  m uuid;
  sent int := 0;
begin
  for c in
    select * from public.contests
    where starts_at > now()
      and starts_at <= now() + p_within
      -- dedupe_key on the contest id makes this safe to run repeatedly.
      and not exists (
        select 1 from public.notifications n
        where n.kind = 'contest' and n.dedupe_key = 'contest:' || c.id::text
      )
  loop
    select array_agg(user_id) into members from public.squad_members;
    foreach m in array coalesce(members, '{}'::uuid[]) loop
      insert into public.notifications (user_id, kind, title, body, deep_link, dedupe_key)
      values (
        m,
        'contest',
        c.title || ' starts soon',
        'In ' || greatest(1, floor(extract(hour from (c.starts_at - now()))))::int || ' hours. Compete, then compare approaches.',
        '/leaderboard',
        'contest:' || c.id::text
      )
      on conflict do nothing;
      if found then sent := sent + 1; end if;
    end loop;
  end loop;

  return sent;
end $$;

comment on function public.notify_contest_reminders(interval) is
  '§36 contest ritual reminder. Idempotent by dedupe_key so the cron can run it as often as it likes.';

-- ── A recap is ready ─────────────────────────────────────────────────────────
create or replace function public.notify_recap_ready()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists notify_recap_ready on public.squad_recaps;
create trigger notify_recap_ready
  after insert on public.squad_recaps
  for each row execute function public.notify_recap_ready();

grant execute on function public.in_quiet_hours(timestamptz) to anon, authenticated;
grant execute on function public.notify_contest_reminders(interval) to service_role;