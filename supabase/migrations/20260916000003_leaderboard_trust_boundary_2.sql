-- Trust boundary round 2: close list_problems open write, add missing WITH CHECKs,
-- extend constraints, fix RPC retouch + GUC, dedupe + unique indexes.

-- 1. list_problems: anyone authed could insert/edit/delete any list's rows.
-- Reads stay public; writes restricted to the owning list's creator.
-- Service role (seed route) bypasses RLS, unaffected.
drop policy if exists "list_problems_open_access" on public.list_problems;
drop policy if exists "Allow public read access for list_problems" on public.list_problems;
drop policy if exists "Allow authenticated users to insert list_problems" on public.list_problems;
drop policy if exists "Allow authenticated users to manage list_problems" on public.list_problems;

create policy "list_problems_public_read"
  on public.list_problems for select
  using (true);

create policy "list_problems_owner_insert"
  on public.list_problems for insert
  with check (
    exists (
      select 1 from public.custom_lists
      where custom_lists.id = list_id
        and custom_lists.created_by = (select auth.uid())
    )
  );

create policy "list_problems_owner_update"
  on public.list_problems for update
  using (
    exists (
      select 1 from public.custom_lists
      where custom_lists.id = list_id
        and custom_lists.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.custom_lists
      where custom_lists.id = list_id
        and custom_lists.created_by = (select auth.uid())
    )
  );

create policy "list_problems_owner_delete"
  on public.list_problems for delete
  using (
    exists (
      select 1 from public.custom_lists
      where custom_lists.id = list_id
        and custom_lists.created_by = (select auth.uid())
    )
  );

-- 2. Missing WITH CHECKs: USING-only update lets a caller reassign the row
-- to someone else (new row unchecked). Pin the owner columns on write.
drop policy if exists "Users can update own custom lists" on public.custom_lists;
create policy "Users can update own custom lists" on public.custom_lists
  for update
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- Orphan lists (created_by null) were client-creatable; only service role seeds those.
drop policy if exists "Users can create custom lists" on public.custom_lists;
create policy "Users can create custom lists" on public.custom_lists
  for insert with check ((select auth.uid()) = created_by);

drop policy if exists "Users can manage own problem status" on public.user_problem_status;
create policy "Users can manage own problem status" on public.user_problem_status
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own suggestions" on public.suggestions;
create policy "Users can manage own suggestions" on public.suggestions
  for update
  using (((select auth.uid()) = from_user) or ((select auth.uid()) = to_user))
  with check (((select auth.uid()) = from_user) or ((select auth.uid()) = to_user));

-- Suggestion parties/problem immutable: assignee must not reassign a challenge.
create or replace function public.lock_suggestion_parties()
returns trigger
language plpgsql
as $$
begin
  if new.from_user is distinct from old.from_user
    or new.to_user is distinct from old.to_user
    or new.problem_slug is distinct from old.problem_slug then
    raise exception 'suggestion parties and problem are immutable';
  end if;
  return new;
end $$;

drop trigger if exists lock_suggestion_parties on public.suggestions;
create trigger lock_suggestion_parties
  before update on public.suggestions
  for each row execute function public.lock_suggestion_parties();

-- Leftover bare auth.uid() policies (initplan perf warnings).
drop policy if exists "Users can create own feed events" on public.feed_events;
create policy "Users can create own feed events" on public.feed_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own feed events" on public.feed_events;
create policy "Users can manage own feed events" on public.feed_events
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Extended guard rails. NOT VALID: new writes enforced, legacy rows grandfathered
-- (earlier unbounded imports may hold junk; grandfather instead of failing push).
alter table public.profiles
  add constraint profiles_rank_nonnegative
  check (
    coalesce(global_rank, 0) >= 0
    and coalesce(contest_global_rank, 0) >= 0
    and coalesce(contest_top_percentage, 0) >= 0
    and coalesce(contest_top_percentage, 0) <= 100
  ) not valid;

alter table public.profiles
  add constraint profiles_username_len
  check (char_length(username) between 1 and 50) not valid;

alter table public.profiles
  add constraint profiles_handle_len
  check (leetcode_username is null or char_length(leetcode_username) between 1 and 50) not valid;

alter table public.user_problem_status
  add constraint user_problem_status_slug_format
  check (problem_slug ~ '^[a-z0-9-]{1,80}$') not valid;

alter table public.user_problem_status
  add constraint user_problem_status_notes_cap
  check (notes is null or octet_length(notes) <= 5000) not valid;

alter table public.suggestions
  add constraint suggestions_slug_format
  check (problem_slug ~ '^[a-z0-9-]{1,80}$') not valid;

alter table public.suggestions
  add constraint suggestions_note_cap
  check (note is null or octet_length(note) <= 2000) not valid;

alter table public.list_problems
  add constraint list_problems_slug_format
  check (title_slug ~ '^[a-z0-9-]{1,80}$') not valid;

alter table public.custom_lists
  add constraint custom_lists_slug_format
  check (slug ~ '^[a-z0-9-]{1,80}$') not valid;

-- 4. RPC fix: old guard retouched already-solved rows (solved_at churn on every
-- sync) and never set the GUC the preserve-attempted trigger checks, so the
-- verified path could not promote attempted rows. Promote-only + GUC on.
create or replace function public.mark_solved_from_leetcode(p_user_id uuid, p_slugs text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
begin
  perform set_config('app.allow_attempted_promotion', 'on', true);
  with ins as (
    insert into public.user_problem_status (user_id, problem_slug, status, solved_at)
    select p_user_id, unnest(p_slugs), 'solved', now()
    on conflict (user_id, problem_slug) do update
      set status = 'solved', solved_at = now()
      where public.user_problem_status.status = 'attempted'
    returning 1
  )
  select count(*) into affected from ins;
  return affected;
end $$;

revoke all on function public.mark_solved_from_leetcode(uuid, text[]) from anon, authenticated;

-- 5. Dedupe, then unique indexes (spam-proofing).
-- Duplicate pending suggestions: keep earliest, dismiss the rest (no data loss).
with ranked as (
  select id, row_number() over (
    partition by to_user, problem_slug order by created_at, id
  ) as rn
  from public.suggestions
  where status = 'pending'
)
update public.suggestions
  set status = 'dismissed'
  from ranked
  where public.suggestions.id = ranked.id and ranked.rn > 1;

create unique index if not exists suggestions_pending_unique
  on public.suggestions (to_user, problem_slug)
  where status = 'pending';

delete from public.list_problems a
  using public.list_problems b
  where a.id > b.id
    and a.list_id = b.list_id
    and a.title_slug = b.title_slug;

create unique index if not exists list_problems_list_slug_unique
  on public.list_problems (list_id, title_slug);

select pg_notify('pgrst', 'reload schema');
