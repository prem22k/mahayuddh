-- Step 21 — Feed surfaces: follows, blocks, reports, discussions, platform.
--
-- §19 wants four feeds (Squad, Following, Global, Platform). Three of them
-- need rows that did not exist: `follows` for Following, moderation primitives
-- for §51, a place for problem-linked discussion, and somewhere for
-- admin-written platform announcements that are not mixed into the activity
-- stream.

-- ── Platform admin ───────────────────────────────────────────────────────────
-- §19 defines the Platform tab as "contests/product/maintenance only,
-- admin-write". There was no product-admin concept in the codebase: the only
-- `role` column belongs to squad_members and means squad ownership.
--
-- SECURITY: profiles has a blanket self-update policy ("Users can update own
-- display name" is `for update using (auth.uid() = id)`), so a plain column
-- would let ANY user set their own is_product_admin to true and then post
-- platform announcements. The guard trigger below is what prevents that, and
-- it is verified against the live database in tests/integration/.
alter table public.profiles add column if not exists is_product_admin boolean not null default false;

create or replace function public.guard_product_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_product_admin is distinct from new.is_product_admin
     and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'is_product_admin is set by the platform only';
  end if;
  return new;
end $$;

drop trigger if exists guard_product_admin on public.profiles;
create trigger guard_product_admin
  before update on public.profiles
  for each row execute function public.guard_product_admin();

-- ── Following (§21) ──────────────────────────────────────────────────────────
-- Built here rather than deferred to Step 22 so the Following tab has
-- something to read. A tab that renders nothing is exactly the dead
-- affordance this codebase already refuses to ship.
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  followed_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows (followed_id);

-- ── Blocks (§51) ─────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- ── Discussion (§51 "meaningful discussion", §20 ranking signal) ──────────────
-- Problem-linked and rate-limited. This is the only prose-authored object in
-- the feed, which is why the gates in the next migration are strict: §50 warns
-- that a feed needing people to "be content creators" will die, so discussion is
-- additive to auto-generated activity, never a requirement for a non-empty feed.
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  pattern_tags text[] not null default '{}',
  -- Both required. §51 lists problem-linked and pattern-linked as what makes a
  -- post high quality; a check constraint is cheaper and more reliable than
  -- trusting a client form.
  body_md text not null check (char_length(trim(body_md)) between 1 and 4000),
  squad_id uuid references public.squads(id) on delete set null,
  visibility text not null default 'squad' check (visibility in ('squad', 'global')),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  constraint discussions_pattern_linked check (cardinality(pattern_tags) >= 1)
);
create index if not exists discussions_problem_idx on public.discussions (problem_slug, created_at desc);
create index if not exists discussions_author_idx on public.discussions (author_id, created_at desc)
  where deleted_at is null;

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid references public.discussions(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  body_md text not null check (char_length(trim(body_md)) between 1 and 2000),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now()
);
create index if not exists discussion_replies_discussion_idx
  on public.discussion_replies (discussion_id, created_at)
  where deleted_at is null;

-- ── Reports (§51) ────────────────────────────────────────────────────────────
-- Narrow on purpose. §51 says not to build a giant moderation platform before
-- public posting is validated; this is a row, not a queue product.
--
-- Created after `discussions` because of the foreign key below.
--
-- Two partial unique indexes rather than one composite UNIQUE: a UNIQUE over
-- (reporter_id, event_id, discussion_id) treats NULL as distinct from every
-- other NULL, so reporting the same discussion twice would sail straight past
-- it — exactly the case this constraint exists to stop.
create table if not exists public.feed_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.feed_events(id) on delete cascade,
  discussion_id uuid references public.discussions(id) on delete cascade,
  reason text not null check (reason in ('spam', 'noise', 'copied', 'bait', 'abuse', 'other')),
  detail text check (detail is null or octet_length(detail) <= 1000),
  created_at timestamp with time zone default now(),
  constraint feed_reports_has_target check (event_id is not null or discussion_id is not null)
);
create unique index if not exists feed_reports_event_unique
  on public.feed_reports (reporter_id, event_id) where event_id is not null;
create unique index if not exists feed_reports_discussion_unique
  on public.feed_reports (reporter_id, discussion_id) where discussion_id is not null;
create index if not exists feed_reports_event_idx on public.feed_reports (event_id);

-- ── Platform posts (§19) ─────────────────────────────────────────────────────
-- Separate from feed_events on purpose. A platform announcement is
-- admin-written, has no actor, and is not activity. Mixing them would let the
-- ranking expression treat a maintenance notice as something a developer did.
create table if not exists public.platform_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('contest', 'product', 'maintenance')),
  title text not null check (char_length(title) between 1 and 120),
  body_md text not null check (char_length(trim(body_md)) between 1 and 4000),
  href text check (href is null or href ~ '^https?://'),
  pinned boolean not null default false,
  created_at timestamp with time zone default now()
);
create index if not exists platform_posts_recent_idx on public.platform_posts (pinned desc, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.feed_reports enable row level security;
alter table public.discussions enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.platform_posts enable row level security;

-- follows: visible to both parties, writable only by the follower.
drop policy if exists "Follows readable by both parties" on public.follows;
create policy "Follows readable by both parties" on public.follows for select
  using ((select auth.uid()) = follower_id or (select auth.uid()) = followed_id);
drop policy if exists "Users follow and unfollow themselves" on public.follows;
create policy "Users follow and unfollow themselves" on public.follows for all
  using ((select auth.uid()) = follower_id)
  with check ((select auth.uid()) = follower_id);

-- blocks: private. Only the blocker can see their own blocks, so blocking
-- cannot itself leak that someone blocked you.
drop policy if exists "Users see own blocks" on public.user_blocks;
create policy "Users see own blocks" on public.user_blocks for select
  using ((select auth.uid()) = blocker_id);
drop policy if exists "Users block and unblock" on public.user_blocks;
create policy "Users block and unblock" on public.user_blocks for all
  using ((select auth.uid()) = blocker_id)
  with check ((select auth.uid()) = blocker_id);

-- reports: readable only by the reporter. Nobody can see whether their report
-- was acted on, and nobody can see who else reported something.
drop policy if exists "Reporters see own reports" on public.feed_reports;
create policy "Reporters see own reports" on public.feed_reports for select
  using ((select auth.uid()) = reporter_id);
drop policy if exists "Users report content" on public.feed_reports;
create policy "Users report content" on public.feed_reports for insert
  with check ((select auth.uid()) = reporter_id);

-- discussions: public rows, own writes, own deletes (soft, so replies survive).
drop policy if exists "Discussions publicly readable" on public.discussions;
create policy "Discussions publicly readable" on public.discussions for select
  using (deleted_at is null);
drop policy if exists "Users create discussions" on public.discussions;
create policy "Users create discussions" on public.discussions for insert
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors update own discussions" on public.discussions;
create policy "Authors update own discussions" on public.discussions for update
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors delete own discussions" on public.discussions;
create policy "Authors delete own discussions" on public.discussions for delete
  using ((select auth.uid()) = author_id);

drop policy if exists "Replies publicly readable" on public.discussion_replies;
create policy "Replies publicly readable" on public.discussion_replies for select
  using (deleted_at is null);
drop policy if exists "Users create replies" on public.discussion_replies;
create policy "Users create replies" on public.discussion_replies for insert
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors delete own replies" on public.discussion_replies;
create policy "Authors delete own replies" on public.discussion_replies for delete
  using ((select auth.uid()) = author_id);

-- platform_posts: world-readable, but write is admin-only and there is no
-- update or delete policy at all — announcements are append-only.
drop policy if exists "Platform posts readable" on public.platform_posts;
create policy "Platform posts readable" on public.platform_posts for select using (true);
drop policy if exists "Product admins post platform notes" on public.platform_posts;
create policy "Product admins post platform notes" on public.platform_posts for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_product_admin
    )
  );