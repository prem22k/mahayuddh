-- Phase 3 Step 18: I'm Stuck ladder (Bible §12, §45 later).
--
-- The product rule: least help to continue thinking, not fastest answer. The
-- ladder encodes that as a level on the request, so a helper cannot answer at
-- "full explanation" when the asker only wanted a nudge.

create table if not exists public.stuck_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  battle_id uuid references public.battles(id) on delete set null,
  -- How much help the asker actually wants.
  level text check (level in ('nudge', 'pattern', 'direction', 'full'))
    default 'nudge' not null,
  -- anon = nobody can see who is stuck, only that somebody is.
  visibility text check (visibility in ('squad', 'public', 'anon'))
    default 'squad' not null,
  squad_id uuid references public.squads(id) on delete set null,
  status text check (status in ('open', 'helped', 'resolved'))
    default 'open' not null,
  last_reminded_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create index if not exists stuck_requests_open_idx
  on public.stuck_requests (created_at desc) where status = 'open';
create index if not exists stuck_requests_user_idx
  on public.stuck_requests (user_id, created_at desc);
create index if not exists stuck_requests_problem_idx
  on public.stuck_requests (problem_slug, created_at desc);

create table if not exists public.stuck_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.stuck_requests(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  -- A reply may not exceed the level that was asked for: answering a nudge
  -- with a full solution is exactly the failure mode §12 warns about.
  level text check (level in ('nudge', 'pattern', 'direction', 'full')) not null,
  body_md text not null check (char_length(body_md) between 1 and 4000),
  accepted boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create index if not exists stuck_replies_request_idx
  on public.stuck_replies (request_id, created_at asc);

alter table public.stuck_requests enable row level security;
alter table public.stuck_replies enable row level security;

-- ── Visibility ──────────────────────────────────────────────────────────────
-- A request is readable by: its author, members of its squad, everyone when
-- visibility='public', and everyone-but-the-author when visibility='anon'.
create policy "Stuck requests readable by participants" on public.stuck_requests
  for select using (
    (select auth.uid()) = user_id
    or visibility = 'public'
    or visibility = 'anon'
    or (
      squad_id is not null and exists (
        select 1 from public.squad_members
        where squad_members.squad_id = stuck_requests.squad_id
        and squad_members.user_id = (select auth.uid())
      )
    )
  );

create policy "Authors create own stuck requests" on public.stuck_requests
  for insert with check ((select auth.uid()) = user_id);

-- Only the author may close their own request.
create policy "Authors update own stuck requests" on public.stuck_requests
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Authors delete own stuck requests" on public.stuck_requests
  for delete using ((select auth.uid()) = user_id);

-- A reply is readable by the asker, its author, and the asker's squad.
create policy "Stuck replies readable by participants" on public.stuck_replies
  for select using (
    exists (
      select 1 from public.stuck_requests r
      where r.id = stuck_replies.request_id
        and (
          r.user_id = (select auth.uid())
          or r.visibility in ('public', 'anon')
          or (
            r.squad_id is not null and exists (
              select 1 from public.squad_members
              where squad_members.squad_id = r.squad_id
              and squad_members.user_id = (select auth.uid())
            )
          )
        )
    )
    or (select auth.uid()) = author_id
  );

create policy "Authors create own stuck replies" on public.stuck_replies
  for insert with check ((select auth.uid()) = author_id);

-- The asker accepts a reply; the author may edit their own.
create policy "Participants manage stuck replies" on public.stuck_replies
  for update
  using (
    (select auth.uid()) = author_id
    or exists (
      select 1 from public.stuck_requests r
      where r.id = stuck_replies.request_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = author_id
    or exists (
      select 1 from public.stuck_requests r
      where r.id = stuck_replies.request_id and r.user_id = (select auth.uid())
    )
  );

create policy "Authors delete own stuck replies" on public.stuck_replies
  for delete using ((select auth.uid()) = author_id);

-- ── Abuse controls (§51: rate limits, not a moderation platform) ─────────────
-- Max 3 open requests per user. Enforced here rather than in the client so it
-- cannot be bypassed by calling the API directly.
create or replace function public.enforce_stuck_request_limit()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists stuck_request_limit on public.stuck_requests;
create trigger stuck_request_limit
  before insert on public.stuck_requests
  for each row execute function public.enforce_stuck_request_limit();

-- A reply cannot exceed the requested level. Enforced server-side because this
-- is the whole point of the ladder.
create or replace function public.enforce_stuck_reply_level()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists stuck_reply_level on public.stuck_replies;
create trigger stuck_reply_level
  before insert on public.stuck_replies
  for each row execute function public.enforce_stuck_reply_level();

-- Reminder throttle: one nudge per request per 24h.
create or replace function public.stuck_reminder_allowed(p_request_id uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stuck_requests r
    where r.id = p_request_id
      and r.user_id = p_actor
      and r.status = 'open'
      and (r.last_reminded_at is null or r.last_reminded_at < now() - interval '24 hours')
  );
$$;
revoke all on function public.stuck_reminder_allowed(uuid, uuid) from anon, authenticated;

-- Append-only timeline: a solved battle closes any request it answers.
create or replace function public.resolve_stuck_on_solve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.stuck_requests
     set status = 'resolved'
   where user_id = new.user_id
     and problem_slug = new.problem_slug
     and status <> 'resolved'
     and battle_id is not distinct from new.battle_id;
  return new;
end $$;

drop trigger if exists resolve_stuck_on_solve on public.battles;
create trigger resolve_stuck_on_solve
  after update on public.battles
  for each row
  when (old.outcome is distinct from new.outcome and new.outcome = 'solved')
  execute function public.resolve_stuck_on_solve();