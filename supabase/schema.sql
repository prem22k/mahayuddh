-- ============================================================
-- Mahayuddh: Supabase PostgreSQL Schema & RLS Setup
-- ============================================================

-- 1. PROFILES & LEETCODE SYNC
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  leetcode_username text unique not null,
  avatar_url text,
  contest_rating float default 1500,
  global_rank int,
  streak int default 0,
  total_easy int default 0,
  total_medium int default 0,
  total_hard int default 0,
  last_synced_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- 2. CUSTOM SQUAD LISTS & ROADMAPS
create table if not exists public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  emoji text default '📁',
  description text,
  is_curated boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- 3. LIST PROBLEMS
create table if not exists public.list_problems (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.custom_lists(id) on delete cascade not null,
  title text not null,
  title_slug text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  category text not null,
  order_index int default 0
);

-- 4. USER PROBLEM STATUS (Squad Matrix)
create table if not exists public.user_problem_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null,
  status text check (status in ('solved', 'attempted')) default 'solved',
  notes text,
  solved_at timestamp with time zone default now(),
  unique (user_id, problem_slug)
);

-- 5. SUGGESTION BOX (Challenges & Auto-Verification)
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references public.profiles(id) on delete cascade not null,
  to_user uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null,
  problem_title text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  note text,
  status text check (status in ('pending', 'completed', 'dismissed')) default 'pending',
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- 6. SHARED SQUAD RESOURCE VAULT
create table if not exists public.shared_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text check (category in ('Template', 'Interview Log', 'Cheat Sheet', 'Article')) not null,
  content text not null, -- Markdown
  external_url text,
  author_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now()
);

-- 7. PWA PUSH SUBSCRIPTIONS
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

-- 8. LIVE SQUAD FEED EVENTS
create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text check (event_type in ('solved', 'streak', 'contest', 'suggested', 'completed')) not null,
  problem_title text,
  problem_slug text,
  difficulty text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
alter table public.profiles enable row level security;
alter table public.custom_lists enable row level security;
alter table public.list_problems enable row level security;
alter table public.user_problem_status enable row level security;
alter table public.suggestions enable row level security;
alter table public.shared_resources enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.feed_events enable row level security;

-- Read policies: Squad members can view profiles, lists, resources, feed, and status
create policy "Allow public read access for profiles" on public.profiles for select using (true);
create policy "Allow public read access for lists" on public.custom_lists for select using (true);
create policy "Allow public read access for list_problems" on public.list_problems for select using (true);
create policy "Allow public read access for user_problem_status" on public.user_problem_status for select using (true);
create policy "Allow public read access for suggestions" on public.suggestions for select using (true);
create policy "Allow public read access for resources" on public.shared_resources for select using (true);
create policy "Allow public read access for feed_events" on public.feed_events for select using (true);

-- Insert/Update policies
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can manage own suggestions" on public.suggestions for all using (auth.uid() = from_user or auth.uid() = to_user);
create policy "Users can insert problem status" on public.user_problem_status for all using (auth.uid() = user_id);
create policy "Users can manage shared resources" on public.shared_resources for all using (auth.uid() = author_id);
create policy "Users can manage push subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id);

-- ============================================================
-- SEED INITIAL CURATED ROADMAPS
-- ============================================================
insert into public.custom_lists (slug, title, emoji, description, is_curated)
values 
  ('neetcode-150', 'NeetCode 150', 'NeetCode', 'The premier curated roadmap covering all core coding interview patterns.', true),
  ('blind-75', 'Blind 75', 'Blind', 'The essential 75 classic interview questions for fast review.', true),
  ('striver-sde', 'Striver SDE Sheet', 'Striver', 'Comprehensive DSA sheet tailored for top-tier software engineering roles.', true)
on conflict (slug) do nothing;
