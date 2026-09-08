-- ============================================================
-- Mahayuddh: Multi-User Squad RLS & Integrity Policies
-- Enables seamless collaboration across all squad members:
-- 1. Any user can join, create custom lists, challenge peers, and share templates.
-- 2. Problem solving statuses are isolated per user.
-- 3. Public/squad read access for leaderboards, matrices, feeds, and resources.
-- ============================================================

-- 1. Enable RLS on all tables
alter table if exists public.profiles enable row level security;
alter table if exists public.custom_lists enable row level security;
alter table if exists public.list_problems enable row level security;
alter table if exists public.user_problem_status enable row level security;
alter table if exists public.suggestions enable row level security;
alter table if exists public.shared_resources enable row level security;
alter table if exists public.push_subscriptions enable row level security;
alter table if exists public.feed_events enable row level security;
alter table if exists public.problems enable row level security;
alter table if exists public.catalog_sync_state enable row level security;

-- 2. Drop existing policies to prevent conflicts
drop policy if exists "Allow public read access for profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Allow public read access for lists" on public.custom_lists;
drop policy if exists "Users can create custom lists" on public.custom_lists;
drop policy if exists "Users can update own custom lists" on public.custom_lists;
drop policy if exists "Users can delete own custom lists" on public.custom_lists;

drop policy if exists "Allow public read access for list_problems" on public.list_problems;
drop policy if exists "Allow authenticated users to insert list_problems" on public.list_problems;
drop policy if exists "Allow authenticated users to manage list_problems" on public.list_problems;

drop policy if exists "Allow public read access for user_problem_status" on public.user_problem_status;
drop policy if exists "Users can insert problem status" on public.user_problem_status;
drop policy if exists "Users can read own problem status" on public.user_problem_status;
drop policy if exists "Users can manage own problem status" on public.user_problem_status;
drop policy if exists "Users can delete own problem status" on public.user_problem_status;

drop policy if exists "Allow public read access for suggestions" on public.suggestions;
drop policy if exists "Users can insert suggestions" on public.suggestions;
drop policy if exists "Users can manage own suggestions" on public.suggestions;

drop policy if exists "Allow public read access for resources" on public.shared_resources;
drop policy if exists "Users can insert shared resources" on public.shared_resources;
drop policy if exists "Users can update own shared resources" on public.shared_resources;
drop policy if exists "Users can delete own shared resources" on public.shared_resources;

drop policy if exists "Allow public read access for feed_events" on public.feed_events;
drop policy if exists "Users can insert feed events" on public.feed_events;

drop policy if exists "Allow public read access for problems" on public.problems;
drop policy if exists "Allow public read access for catalog_sync_state" on public.catalog_sync_state;

-- 3. PROFILES POLICIES
create policy "Allow public read access for profiles"
  on public.profiles for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. CUSTOM LISTS POLICIES
create policy "Allow public read access for lists"
  on public.custom_lists for select
  using (true);

create policy "Users can create custom lists"
  on public.custom_lists for insert
  with check (auth.uid() = created_by or created_by is null);

create policy "Users can update own custom lists"
  on public.custom_lists for update
  using (auth.uid() = created_by);

create policy "Users can delete own custom lists"
  on public.custom_lists for delete
  using (auth.uid() = created_by);

-- 5. LIST PROBLEMS POLICIES
create policy "Allow public read access for list_problems"
  on public.list_problems for select
  using (true);

create policy "Allow authenticated users to insert list_problems"
  on public.list_problems for insert
  with check (true);

create policy "Allow authenticated users to manage list_problems"
  on public.list_problems for all
  using (true);

-- 6. USER PROBLEM STATUS POLICIES
create policy "Allow public read access for user_problem_status"
  on public.user_problem_status for select
  using (true);

create policy "Users can insert problem status"
  on public.user_problem_status for insert
  with check (auth.uid() = user_id);

create policy "Users can manage own problem status"
  on public.user_problem_status for update
  using (auth.uid() = user_id);

create policy "Users can delete own problem status"
  on public.user_problem_status for delete
  using (auth.uid() = user_id);

-- 7. SUGGESTIONS POLICIES
create policy "Allow public read access for suggestions"
  on public.suggestions for select
  using (true);

create policy "Users can insert suggestions"
  on public.suggestions for insert
  with check (auth.uid() = from_user);

create policy "Users can manage own suggestions"
  on public.suggestions for update
  using (auth.uid() = from_user or auth.uid() = to_user);

-- 8. SHARED RESOURCES POLICIES
create policy "Allow public read access for resources"
  on public.shared_resources for select
  using (true);

create policy "Users can insert shared resources"
  on public.shared_resources for insert
  with check (auth.uid() = author_id);

create policy "Users can update own shared resources"
  on public.shared_resources for update
  using (auth.uid() = author_id);

create policy "Users can delete own shared resources"
  on public.shared_resources for delete
  using (auth.uid() = author_id);

-- 9. FEED EVENTS POLICIES
create policy "Allow public read access for feed_events"
  on public.feed_events for select
  using (true);

create policy "Users can insert feed events"
  on public.feed_events for insert
  with check (auth.uid() = user_id);

-- 10. CATALOG PROBLEMS & SYNC STATE
create policy "Allow public read access for problems"
  on public.problems for select
  using (true);

create policy "Allow public read access for catalog_sync_state"
  on public.catalog_sync_state for select
  using (true);
