-- Primer progress: what you've read and what you've mastered, per primer.
--
-- The primer_read analytics event fires on page open, which isn't reading, and
-- nothing per user was stored. Practice now orders the roadmap by this: unread
-- first, then read, then mastered.
--
--   read_at      set when you reach the end of a primer or tap "Mark as read"
--   mastered_at  set the first time the mastery rule holds (lib/primerMastery.ts);
--                kept after that, so adding problems to a ladder never takes it away
--
-- Keyed by slug, not primer id: progress belongs to the pattern, and the slug
-- is what the roadmap and the hand-written content use.

create table if not exists public.primer_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  primer_slug text not null check (primer_slug ~ '^[a-z0-9-]{1,80}$'),
  read_at timestamptz,
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, primer_slug)
);

alter table public.primer_progress enable row level security;

drop policy if exists "Own primer progress readable" on public.primer_progress;
create policy "Own primer progress readable" on public.primer_progress
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Own primer progress insertable" on public.primer_progress;
create policy "Own primer progress insertable" on public.primer_progress
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Own primer progress updatable" on public.primer_progress;
create policy "Own primer progress updatable" on public.primer_progress
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.primer_progress to authenticated;
