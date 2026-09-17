-- Leaderboard trust boundary: anon/authenticated clients can read stats but never
-- write them, and the encrypted LeetCode session stays server-only.

-- 1. Clients must not update stat/handle/avatar columns directly.
-- Server writes through service role (bypasses RLS). Drop the open self-update.
drop policy if exists "Users can update own profile" on public.profiles;

-- Self-service remains: username + cosmetic avatar only. Everything else is
-- server-written via the sync routes.
create policy "Users can update own display name"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 2. Scoped UPDATE grants: only the display columns are writable by anon/authenticated.
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

-- 3. Revoke column reads that leak to clients. Service role keeps full access.
revoke select (leetcode_session_encrypted) on public.profiles from anon, authenticated;

-- 4. Guard rails on synced stats.
alter table public.profiles
  add constraint profiles_stats_nonnegative
  check (
    coalesce(contest_rating, 0) >= 0
    and coalesce(streak, 0) >= 0
    and coalesce(total_easy, 0) >= 0
    and coalesce(total_medium, 0) >= 0
    and coalesce(total_hard, 0) >= 0
    and coalesce(contest_attended, 0) >= 0
  );

-- 5. LeetCode handles are case-insensitive upstream; store them lowered so
-- Foo/foo cannot claim two rows and lookups match exactly.
create or replace function public.normalize_leetcode_username()
returns trigger
language plpgsql
as $$
begin
  if new.leetcode_username is not null then
    new.leetcode_username := lower(trim(new.leetcode_username));
  end if;
  return new;
end $$;

drop trigger if exists normalize_leetcode_username on public.profiles;
create trigger normalize_leetcode_username
  before insert or update of leetcode_username on public.profiles
  for each row execute function public.normalize_leetcode_username();

-- Backfill existing rows, then enforce uniqueness on the normalized value.
update public.profiles
  set leetcode_username = lower(trim(leetcode_username))
  where leetcode_username is not null
    and leetcode_username <> lower(trim(leetcode_username));

drop index if exists profiles_leetcode_username_lower_unique;
create unique index profiles_leetcode_username_lower_unique
  on public.profiles (lower(leetcode_username));

-- 6. Fix inverted guard: attempted->solved must promote; already-solved need not retouch.
create or replace function public.mark_solved_from_leetcode(p_user_id uuid, p_slugs text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
begin
  with ins as (
    insert into public.user_problem_status (user_id, problem_slug, status, solved_at)
    select p_user_id, unnest(p_slugs), 'solved', now()
    on conflict (user_id, problem_slug) do update
      set status = 'solved', solved_at = now()
      where public.user_problem_status.status = 'attempted'
        or public.user_problem_status.status = 'solved'
    returning 1
  )
  select count(*) into affected from ins;
  return affected;
end $$;

-- 7. Self-attested slug imports must preserve manual attempted flags; only the
-- verified LeetCode path (RPC above) may promote them.
create or replace function public.preserve_attempted_on_manual_import()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'attempted'
    and new.status = 'solved'
    and current_setting('app.allow_attempted_promotion', true) is distinct from 'on' then
    new.status := old.status;
    new.solved_at := old.solved_at;
  end if;
  return new;
end $$;

drop trigger if exists preserve_attempted_on_manual_import on public.user_problem_status;
create trigger preserve_attempted_on_manual_import
  before update on public.user_problem_status
  for each row execute function public.preserve_attempted_on_manual_import();
