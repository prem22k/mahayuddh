-- LeetCode ownership, and "verified" labels only the server can give.
--
-- Until now anyone could link any LeetCode username, and the browser could
-- write the label that says a solve was checked on LeetCode. This migration:
--
-- 1. profiles.leetcode_verified_at: set when the owner proves control of the
--    linked handle by putting a one-time code in their LeetCode profile
--    (Summary or Name). Changing the handle clears it, whatever code path
--    changed it. Clients can never set it.
-- 2. leetcode_verifications: one pending code per user, server-only.
-- 3. claim_leetcode_handle(): proof of control wins. The prover gets the
--    handle; anyone else holding it is released and their LeetCode stats are
--    cleared, so nobody keeps showing someone else's numbers.
-- 4. mark_solved_from_leetcode(): solves pulled from an unverified handle are
--    imported as self-reported and can't promote a manual "attempted" flag.
-- 5. Evidence guards: a browser write (role anon/authenticated) can't set
--    battles.evidence = 'leetcode', and can't label a problem or feed event
--    'leetcode' unless a battle the server checked backs it. Server paths
--    (service role, SECURITY DEFINER functions) keep their labels.

-- 1. Verified-at ----------------------------------------------------------------

alter table public.profiles
  add column if not exists leetcode_verified_at timestamptz;

comment on column public.profiles.leetcode_verified_at is
  'When the owner proved control of leetcode_username with a profile code. Null = self-reported. Cleared when the handle changes.';

-- Public, like the handle itself: squadmates see who is verified.
grant select (leetcode_verified_at) on public.profiles to anon, authenticated;

-- Named to sort after normalize_leetcode_username, so it compares the
-- normalized handle (BEFORE triggers fire in name order).
create or replace function public.reset_leetcode_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Browsers never set verification, on insert or update.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then
      new.leetcode_verified_at := old.leetcode_verified_at;
    else
      new.leetcode_verified_at := null;
    end if;
  end if;

  -- A new handle starts unverified unless this same write verifies it.
  if tg_op = 'UPDATE'
     and lower(trim(new.leetcode_username)) is distinct from lower(trim(old.leetcode_username))
     and new.leetcode_verified_at is not distinct from old.leetcode_verified_at then
    new.leetcode_verified_at := null;
  end if;

  if new.leetcode_username is null then
    new.leetcode_verified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists reset_leetcode_verified on public.profiles;
create trigger reset_leetcode_verified
  before insert or update on public.profiles
  for each row execute function public.reset_leetcode_verified();

-- 2. Pending codes ----------------------------------------------------------------

create table if not exists public.leetcode_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null check (char_length(handle) between 1 and 50),
  code text not null check (code ~ '^MY-[A-Z0-9]{6}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.leetcode_verifications is
  'One pending LeetCode ownership code per user. Written and read only by /api/leetcode/verify (service role).';

alter table public.leetcode_verifications enable row level security;
revoke all on public.leetcode_verifications from anon, authenticated;

-- 3. Claim ----------------------------------------------------------------------

create or replace function public.claim_leetcode_handle(p_user_id uuid, p_handle text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text := lower(trim(p_handle));
  v_released int := 0;
begin
  if v_handle is null or v_handle = '' or char_length(v_handle) > 50 then
    raise exception 'invalid handle';
  end if;

  -- Release every other holder. Their stats came from this handle, so they go
  -- too, and so does a LeetCode profile picture; the next sync of whatever
  -- they link next fills them again.
  update public.profiles
     set leetcode_username = null,
         avatar_url = case when avatar_url like 'https://assets.leetcode.com/%' then null else avatar_url end,
         total_easy = 0, total_medium = 0, total_hard = 0,
         streak = 0,
         contest_rating = null, global_rank = null,
         contest_attended = 0, contest_global_rank = null, contest_top_percentage = null,
         last_synced_at = null
   where lower(leetcode_username) = v_handle
     and id <> p_user_id;
  get diagnostics v_released = row_count;

  -- Switching from another handle: drop that handle's stats as well (the
  -- sync's never-regress floor would otherwise keep the old account's totals).
  update public.profiles
     set avatar_url = case when avatar_url like 'https://assets.leetcode.com/%' then null else avatar_url end,
         total_easy = 0, total_medium = 0, total_hard = 0,
         streak = 0,
         contest_rating = null, global_rank = null,
         contest_attended = 0, contest_global_rank = null, contest_top_percentage = null,
         last_synced_at = null
   where id = p_user_id
     and leetcode_username is not null
     and lower(leetcode_username) <> v_handle;

  update public.profiles
     set leetcode_username = v_handle,
         leetcode_verified_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'profile not found';
  end if;

  delete from public.leetcode_verifications where user_id = p_user_id;
  return v_released;
end $$;

revoke all on function public.claim_leetcode_handle(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_leetcode_handle(uuid, text) to service_role;

-- 4. Imports from unverified handles are self-reported --------------------------

create or replace function public.mark_solved_from_leetcode(p_user_id uuid, p_slugs text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
  newly_solved text[];
  v_verified boolean;
  v_source text;
begin
  select leetcode_verified_at is not null into v_verified
  from public.profiles where id = p_user_id;
  v_verified := coalesce(v_verified, false);
  v_source := case when v_verified then 'leetcode' else 'self' end;

  -- Only a verified handle's submissions may promote a manual "attempted"
  -- flag (preserve_attempted_on_manual_import enforces it).
  perform set_config('app.allow_attempted_promotion', case when v_verified then 'on' else 'off' end, true);

  with ins as (
    insert into public.user_problem_status (user_id, problem_slug, status, solved_at)
    select p_user_id, unnest(p_slugs), 'solved', now()
    on conflict (user_id, problem_slug) do update
      set status = 'solved', solved_at = now()
      where public.user_problem_status.status = 'attempted'
        and v_verified
    returning problem_slug
  )
  select coalesce(array_agg(problem_slug), '{}'), count(*) into newly_solved, affected from ins;

  -- Append-only history. Verified: one LeetCode event per slug, as before,
  -- including slugs already solved by hand. Unverified: an event only for a
  -- slug this call newly marked solved, and only if no solve is logged yet,
  -- so history never says solved while the status still says attempted.
  insert into public.problem_events (user_id, problem_slug, kind, metadata)
  select p_user_id, s, 'solved', jsonb_build_object('source', v_source)
  from unnest(case when v_verified then p_slugs else newly_solved end) as s
  where not exists (
    select 1 from public.problem_events e
    where e.user_id = p_user_id
      and e.problem_slug = s
      and e.kind = 'solved'
      and (not v_verified or e.metadata->>'source' = 'leetcode')
  )
  on conflict do nothing;

  -- Squad activity from LeetCode-only usage (anti-ghost, §50).
  if newly_solved <> '{}' then
    insert into public.feed_events (user_id, event_type, object_type, object_id, squad_id, metadata)
    select p_user_id, 'solve', 'problem', s.slug,
      (select active_squad_id from public.profiles where id = p_user_id),
      jsonb_build_object('duration_sec', null, 'source', v_source)
    from unnest(newly_solved) as s(slug)
    where exists (select 1 from public.profiles where id = p_user_id and active_squad_id is not null);
  end if;

  return affected;
end $$;

revoke all on function public.mark_solved_from_leetcode(uuid, text[]) from public, anon, authenticated;
grant execute on function public.mark_solved_from_leetcode(uuid, text[]) to service_role;

-- 5. Evidence guards --------------------------------------------------------------

-- battles.evidence is stamped by /api/battles/verify (service role) after it
-- finds the accepted submission on a verified handle. Browsers can't set it.
create or replace function public.guard_battle_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.evidence := 'none';
    else
      new.evidence := old.evidence;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_battle_evidence on public.battles;
create trigger guard_battle_evidence
  before insert or update on public.battles
  for each row execute function public.guard_battle_evidence();

-- A browser may log a solve, and may label it LeetCode-checked only when a
-- server-checked battle backs it: the event's own battle, or a checked battle
-- on the same problem in the last day. Otherwise the label is downgraded;
-- other metadata (captions, source = 'composer') is kept.
create or replace function public.guard_client_evidence_label()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_claims boolean;
  v_battle_id uuid;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  v_claims := coalesce(new.metadata->>'source', '') = 'leetcode'
           or coalesce(new.metadata->>'evidence', '') = 'leetcode'
           or coalesce(new.metadata->>'verified', '') in ('true', 'leetcode', 'verified');
  if not v_claims then
    return new;
  end if;

  if tg_table_name = 'problem_events' then
    v_battle_id := new.battle_id;
  elsif new.object_type = 'battle' and new.object_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_battle_id := new.object_id::uuid;
  end if;

  if v_battle_id is not null and exists (
    select 1 from public.battles b
    where b.id = v_battle_id and b.user_id = new.user_id and b.evidence = 'leetcode'
  ) then
    return new;
  end if;

  if new.problem_slug is not null and exists (
    select 1 from public.battles b
    where b.user_id = new.user_id
      and lower(b.problem_slug) = lower(new.problem_slug)
      and b.evidence = 'leetcode'
      and b.started_at > now() - interval '1 day'
  ) then
    return new;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  if new.metadata->>'source' = 'leetcode' then
    new.metadata := jsonb_set(new.metadata, '{source}', '"self"');
  end if;
  if new.metadata ? 'evidence' then
    new.metadata := jsonb_set(new.metadata, '{evidence}', '"none"');
  end if;
  if new.metadata ? 'verified' then
    new.metadata := jsonb_set(new.metadata, '{verified}', 'false');
  end if;
  return new;
end $$;

drop trigger if exists guard_client_evidence_label on public.problem_events;
create trigger guard_client_evidence_label
  before insert or update on public.problem_events
  for each row execute function public.guard_client_evidence_label();

drop trigger if exists guard_client_evidence_label on public.feed_events;
create trigger guard_client_evidence_label
  before insert or update on public.feed_events
  for each row execute function public.guard_client_evidence_label();

-- Trigger functions run whatever the EXECUTE grants; nobody calls them directly.
revoke all on function public.reset_leetcode_verified() from public, anon, authenticated;
revoke all on function public.guard_battle_evidence() from public, anon, authenticated;
revoke all on function public.guard_client_evidence_label() from public, anon, authenticated;
