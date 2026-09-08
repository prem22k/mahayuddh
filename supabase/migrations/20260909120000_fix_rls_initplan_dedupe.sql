-- Fix RLS initplan (wrap auth.uid() in subselect) and dedupe overlapping policies.
-- Also revokes direct authenticated EXECUTE on mark_solved_from_leetcode:
-- all app call sites use the service-role client inside API routes, so direct
-- RPC access was an unneeded abuse vector (any authed user could mark any user_id solved).

-- 1. RPC hardening: service_role only.
revoke all on function public.mark_solved_from_leetcode(uuid, text[]) from authenticated;

-- 2. list_problems: two overlapping policies ("insert" + ALL "manage") caused
-- multiple_permissive warnings on every action. Single open ALL policy preserves behavior.
drop policy if exists "Allow authenticated users to insert list_problems" on public.list_problems;
drop policy if exists "Allow authenticated users to manage list_problems" on public.list_problems;
create policy "list_problems_open_access" on public.list_problems
  for all using (true) with check (true);

-- 3. shared_resources: blanket ALL "manage" overlapped the per-action own-row
-- policies on every action. Drop it, keep narrow policies + public read.
drop policy if exists "Users can manage shared resources" on public.shared_resources;

-- 4. Rewrite every auth.uid() policy with (select auth.uid()) initplan fix.

drop policy if exists "Users can create custom lists" on public.custom_lists;
create policy "Users can create custom lists" on public.custom_lists
  for insert with check (((select auth.uid()) = created_by) or (created_by is null));

drop policy if exists "Users can delete own custom lists" on public.custom_lists;
create policy "Users can delete own custom lists" on public.custom_lists
  for delete using ((select auth.uid()) = created_by);

drop policy if exists "Users can update own custom lists" on public.custom_lists;
create policy "Users can update own custom lists" on public.custom_lists
  for update using ((select auth.uid()) = created_by);

drop policy if exists "Users can insert feed events" on public.feed_events;
create policy "Users can insert feed events" on public.feed_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can manage push subscriptions" on public.push_subscriptions;
create policy "Users can manage push subscriptions" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own shared resources" on public.shared_resources;
create policy "Users can delete own shared resources" on public.shared_resources
  for delete using ((select auth.uid()) = author_id);

drop policy if exists "Users can insert shared resources" on public.shared_resources;
create policy "Users can insert shared resources" on public.shared_resources
  for insert with check ((select auth.uid()) = author_id);

drop policy if exists "Users can update own shared resources" on public.shared_resources;
create policy "Users can update own shared resources" on public.shared_resources
  for update using ((select auth.uid()) = author_id);

drop policy if exists "Users can insert suggestions" on public.suggestions;
create policy "Users can insert suggestions" on public.suggestions
  for insert with check ((select auth.uid()) = from_user);

drop policy if exists "Users can manage own suggestions" on public.suggestions;
create policy "Users can manage own suggestions" on public.suggestions
  for update using (((select auth.uid()) = from_user) or ((select auth.uid()) = to_user));

drop policy if exists "Users can insert problem status" on public.user_problem_status;
create policy "Users can insert problem status" on public.user_problem_status
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own problem status" on public.user_problem_status;
create policy "Users can manage own problem status" on public.user_problem_status
  for update using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own problem status" on public.user_problem_status;
create policy "Users can delete own problem status" on public.user_problem_status
  for delete using ((select auth.uid()) = user_id);

select pg_notify('pgrst', 'reload schema');
