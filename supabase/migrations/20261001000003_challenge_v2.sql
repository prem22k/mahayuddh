-- Phase 1 Step 10: Challenge v2 (Bible §8, §9, §10, §42).
-- Async stays async. Adds: time target, deadline, pass-along chains, spoiler gate.
-- No betting/wagers (explicit Bible ban).

alter table public.suggestions
  add column if not exists sender_time_sec int check (sender_time_sec is null or sender_time_sec >= 0),
  add column if not exists beat_time boolean default false not null,
  add column if not exists deadline_at timestamp with time zone,
  add column if not exists parent_id uuid references public.suggestions(id) on delete set null,
  add column if not exists spoiler boolean default false not null;

create index if not exists suggestions_parent_idx on public.suggestions (parent_id);
create index if not exists suggestions_to_pending_idx on public.suggestions (to_user, status) where status = 'pending';

-- Extend immutability: parties + problem + time contract locked after send.
-- Only status/completed_at may change (accept/complete/decline flow).
create or replace function public.lock_suggestion_parties()
returns trigger language plpgsql as $$
begin
  if new.from_user is distinct from old.from_user
    or new.to_user is distinct from old.to_user
    or new.problem_slug is distinct from old.problem_slug
    or new.sender_time_sec is distinct from old.sender_time_sec
    or new.beat_time is distinct from old.beat_time
    or new.deadline_at is distinct from old.deadline_at
    or new.parent_id is distinct from old.parent_id then
    raise exception 'suggestion parties, problem and challenge terms are immutable';
  end if;
  return new;
end $$;
