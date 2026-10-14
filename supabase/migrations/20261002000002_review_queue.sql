-- Phase 2 Step 14: revision queue (Bible §25). Simple revisit system, no SRS.
-- Reasons: failed attempt | long gap | weak pattern | manual bookmark | low confidence.
-- Reconciled by refreshReviewQueue() on hub visits; solved clears failed rows.

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  reason text check (reason in ('failed', 'gap', 'weak_pattern', 'bookmark', 'low_confidence')) not null,
  due_at timestamp with time zone default now() not null,
  done_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
-- One open row per (user, slug, reason): no duplicate dues.
create unique index if not exists review_queue_open_unique
  on public.review_queue (user_id, problem_slug, reason) where done_at is null;
create index if not exists review_queue_user_open_idx
  on public.review_queue (user_id, due_at) where done_at is null;

alter table public.review_queue enable row level security;

-- Private learning data: own rows only, all operations.
create policy "Users manage own review queue" on public.review_queue
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
