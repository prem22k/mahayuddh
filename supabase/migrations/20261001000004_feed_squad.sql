-- Phase 1 Step 11: squad-scoped activity feed (Bible §18, §19, §50, §64).
-- Feed rows stay normalized events (actor/event/object/squad/metadata), never blobs.

alter table public.feed_events
  add column if not exists squad_id uuid references public.squads(id) on delete cascade,
  add column if not exists object_type text,
  add column if not exists object_id text;

alter table public.feed_events drop constraint if exists feed_events_event_type_check;
alter table public.feed_events
  add constraint feed_events_event_type_check
  check (event_type in (
    'solved', 'streak', 'contest', 'suggested', 'completed',
    'solve', 'teach', 'challenge', 'complete', 'improve',
    'stuck', 'resource', 'squad_milestone'
  ));

create index if not exists feed_events_squad_idx on public.feed_events (squad_id, created_at desc);
create index if not exists feed_events_recent_idx on public.feed_events (created_at desc);
