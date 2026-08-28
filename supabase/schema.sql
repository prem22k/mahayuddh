-- ============================================================
-- Mahayuddh: Supabase PostgreSQL Schema & RLS Setup
-- ============================================================

-- 1. PROFILES & LEETCODE SYNC
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  leetcode_username text unique,
  avatar_url text,
  contest_rating float default 1500,
  global_rank int,
  streak int default 0,
  total_easy int default 0,
  total_medium int default 0,
  total_hard int default 0,
  last_synced_at timestamp with time zone default now(),
  leetcode_session_encrypted text,
  leetcode_session_synced_at timestamp with time zone,
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
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can create custom lists" on public.custom_lists for insert with check (auth.uid() = created_by);
create policy "Users can manage own suggestions" on public.suggestions for all using (auth.uid() = from_user or auth.uid() = to_user);
create policy "Users can insert problem status" on public.user_problem_status for insert with check (auth.uid() = user_id);
create policy "Users can read own problem status" on public.user_problem_status for select using (auth.uid() = user_id);
create policy "Users can manage own problem status" on public.user_problem_status for update using (auth.uid() = user_id);
create policy "Users can delete own problem status" on public.user_problem_status for delete using (auth.uid() = user_id);
create policy "Users can manage shared resources" on public.shared_resources for all using (auth.uid() = author_id);
create policy "Users can manage push subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id);
create policy "Users can create own feed events" on public.feed_events for insert with check (auth.uid() = user_id);
create policy "Users can manage own feed events" on public.feed_events for all using (auth.uid() = user_id);

-- ============================================================
-- SEED INITIAL CURATED ROADMAPS
-- ============================================================
insert into public.custom_lists (slug, title, emoji, description, is_curated)
values
  ('neetcode-150', 'NeetCode 150', 'NeetCode', 'The premier curated roadmap covering all core coding interview patterns.', true),
  ('blind-75', 'Blind 75', 'Blind', 'The essential 75 classic interview questions for fast review.', true),
  ('striver-sde', 'Striver SDE Sheet', 'Striver', 'Comprehensive DSA sheet tailored for top-tier software engineering roles.', true)
on conflict (slug) do nothing;

-- ============================================================
-- SEED LIST PROBLEMS (real LeetCode slugs so Arena/POTD work)
-- ============================================================
do $$
declare
  v_neetcode uuid := (select id from public.custom_lists where slug = 'neetcode-150');
  v_blind uuid := (select id from public.custom_lists where slug = 'blind-75');
  v_striver uuid := (select id from public.custom_lists where slug = 'striver-sde');
begin
  insert into public.list_problems (list_id, title, title_slug, difficulty, category, order_index)
  values
    -- NeetCode 150 core set
    (v_neetcode, 'Two Sum', 'two-sum', 'Easy', 'Arrays & Hashing', 1),
    (v_neetcode, 'Valid Anagram', 'valid-anagram', 'Easy', 'Arrays & Hashing', 2),
    (v_neetcode, 'Contains Duplicate', 'contains-duplicate', 'Easy', 'Arrays & Hashing', 3),
    (v_neetcode, 'Group Anagrams', 'group-anagrams', 'Medium', 'Arrays & Hashing', 4),
    (v_neetcode, 'Top K Frequent Elements', 'top-k-frequent-elements', 'Medium', 'Arrays & Hashing', 5),
    (v_neetcode, 'Valid Parentheses', 'valid-parentheses', 'Easy', 'Stack', 6),
    (v_neetcode, 'Implement Queue using Stacks', 'implement-queue-using-stacks', 'Easy', 'Stack', 7),
    (v_neetcode, 'Evaluate Reverse Polish Notation', 'evaluate-reverse-polish-notation', 'Medium', 'Stack', 8),
    (v_neetcode, 'Generate Parentheses', 'generate-parentheses', 'Medium', 'Backtracking', 9),
    (v_neetcode, 'Word Search', 'word-search', 'Medium', 'Backtracking', 10),
    (v_neetcode, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 11),
    (v_neetcode, 'Clone Graph', 'clone-graph', 'Medium', 'Graphs', 12),
    (v_neetcode, 'Course Schedule', 'course-schedule', 'Medium', 'Graphs', 13),
    (v_neetcode, 'Pacific Atlantic Ocean Currents', 'pacific-atlantic-water-flow', 'Medium', 'Graphs', 14),
    (v_neetcode, 'Binary Tree Inorder Traversal', 'binary-tree-inorder-traversal', 'Easy', 'Trees', 15),
    (v_neetcode, 'Maximum Depth of Binary Tree', 'maximum-depth-of-binary-tree', 'Easy', 'Trees', 16),
    (v_neetcode, 'Invert Binary Tree', 'invert-binary-tree', 'Easy', 'Trees', 17),
    (v_neetcode, 'Binary Tree Level Order Traversal', 'binary-tree-level-order-traversal', 'Medium', 'Trees', 18),
    (v_neetcode, 'Lowest Common Ancestor of a BST', 'lowest-common-ancestor-of-a-binary-search-tree', 'Medium', 'Trees', 19),
    (v_neetcode, 'Validate Binary Search Tree', 'validate-binary-search-tree', 'Medium', 'Trees', 20),
    (v_neetcode, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 21),
    (v_neetcode, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 22),
    (v_neetcode, 'Linked List Cycle', 'linked-list-cycle', 'Easy', 'Linked List', 23),
    (v_neetcode, 'Reorder List', 'reorder-list', 'Medium', 'Linked List', 24),
    (v_neetcode, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 25),
    (v_neetcode, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 26),
    (v_neetcode, 'Find Minimum in Rotated Sorted Array', 'find-minimum-in-rotated-sorted-array', 'Medium', 'Binary Search', 27),
    (v_neetcode, 'Climbing Stairs', 'climbing-stairs', 'Easy', '1-D Dynamic Programming', 28),
    (v_neetcode, 'House Robber', 'house-robber', 'Medium', '1-D Dynamic Programming', 29),
    (v_neetcode, 'Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'Easy', '1-D Dynamic Programming', 30),
    (v_neetcode, 'Coin Change', 'coin-change', 'Medium', 'Dynamic Programming', 31),
    (v_neetcode, 'Longest Increasing Subsequence', 'longest-increasing-subsequence', 'Medium', 'Dynamic Programming', 32),
    (v_neetcode, 'Word Break', 'word-break', 'Medium', 'Dynamic Programming', 33),
    (v_neetcode, 'Sliding Window Maximum', 'sliding-window-maximum', 'Hard', 'Sliding Window', 34),
    (v_neetcode, 'Longest Substring Without Repeating Characters', 'longest-substring-without-repeating-characters', 'Medium', 'Sliding Window', 35),
    (v_neetcode, 'Minimum Window Substring', 'minimum-window-substring', 'Hard', 'Sliding Window', 36),
    (v_neetcode, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 37),
    (v_neetcode, 'Insert Interval', 'insert-interval', 'Medium', 'Intervals', 38),
    (v_neetcode, 'Meeting Rooms', 'meeting-rooms', 'Easy', 'Intervals', 39),
    (v_neetcode, '3Sum', '3sum', 'Medium', 'Two Pointers', 40),
    (v_neetcode, 'Valid Palindrome', 'valid-palindrome', 'Easy', 'Two Pointers', 41),
    (v_neetcode, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 42),
    (v_neetcode, 'Container With Most Water', 'container-with-most-water', 'Medium', 'Two Pointers', 43),
    (v_neetcode, 'Product of Array Except Self', 'product-of-array-except-self', 'Medium', 'Arrays & Hashing', 44),
    (v_neetcode, 'LRU Cache', 'lru-cache', 'Medium', 'Design', 45),
    (v_neetcode, 'Implement Trie Prefix Tree', 'implement-trie-prefix-tree', 'Medium', 'Design', 46),
    (v_neetcode, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 47),
    (v_neetcode, 'Serialize and Deserialize Binary Tree', 'serialize-and-deserialize-binary-tree', 'Hard', 'Trees', 48),
    (v_neetcode, 'Subarray Sum Equals K', 'subarray-sum-equals-k', 'Medium', 'Arrays & Hashing', 49),
    -- Blind 75 essential set
    (v_blind, 'Two Sum', 'two-sum', 'Easy', 'Arrays & Hashing', 1),
    (v_blind, 'Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'Easy', 'Dynamic Programming', 2),
    (v_blind, 'Valid Parentheses', 'valid-parentheses', 'Easy', 'Stack', 3),
    (v_blind, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 4),
    (v_blind, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 5),
    (v_blind, 'Maximum Depth of Binary Tree', 'maximum-depth-of-binary-tree', 'Easy', 'Trees', 6),
    (v_blind, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 7),
    (v_blind, 'Course Schedule', 'course-schedule', 'Medium', 'Graphs', 8),
    (v_blind, '3Sum', '3sum', 'Medium', 'Two Pointers', 9),
    (v_blind, 'Container With Most Water', 'container-with-most-water', 'Medium', 'Two Pointers', 10),
    (v_blind, 'Longest Substring Without Repeating Characters', 'longest-substring-without-repeating-characters', 'Medium', 'Sliding Window', 11),
    (v_blind, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 12),
    (v_blind, 'Climbing Stairs', 'climbing-stairs', 'Easy', 'Dynamic Programming', 13),
    (v_blind, 'Word Break', 'word-break', 'Medium', 'Dynamic Programming', 14),
    (v_blind, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 15),
    (v_blind, 'Lru Cache', 'lru-cache', 'Medium', 'Design', 16),
    (v_blind, 'Top K Frequent Elements', 'top-k-frequent-elements', 'Medium', 'Arrays & Hashing', 17),
    (v_blind, 'Group Anagrams', 'group-anagrams', 'Medium', 'Arrays & Hashing', 18),
    (v_blind, 'Generate Parentheses', 'generate-parentheses', 'Medium', 'Backtracking', 19),
    (v_blind, 'Word Search', 'word-search', 'Medium', 'Backtracking', 20),
    (v_blind, 'Clone Graph', 'clone-graph', 'Medium', 'Graphs', 21),
    (v_blind, 'Validate Binary Search Tree', 'validate-binary-search-tree', 'Medium', 'Trees', 22),
    (v_blind, 'Binary Tree Level Order Traversal', 'binary-tree-level-order-traversal', 'Medium', 'Trees', 23),
    (v_blind, 'Lowest Common Ancestor of a BST', 'lowest-common-ancestor-of-a-binary-search-tree', 'Medium', 'Trees', 24),
    (v_blind, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 25),
    (v_blind, 'Linked List Cycle', 'linked-list-cycle', 'Easy', 'Linked List', 26),
    (v_blind, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 27),
    (v_blind, 'Meeting Rooms', 'meeting-rooms', 'Easy', 'Intervals', 28),
    (v_blind, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 29),
    (v_blind, 'Product of Array Except Self', 'product-of-array-except-self', 'Medium', 'Arrays & Hashing', 30),
    (v_blind, 'Minimum Window Substring', 'minimum-window-substring', 'Hard', 'Sliding Window', 31),
    -- Striver SDE Sheet core set
    (v_striver, 'Two Sum', 'two-sum', 'Easy', 'Arrays', 1),
    (v_striver, 'Sort an Array', 'sort-an-array', 'Medium', 'Arrays', 2),
    (v_striver, 'Kadanes Algorithm', 'maximum-subarray', 'Medium', 'Arrays', 3),
    (v_striver, 'Next Permutation', 'next-permutation', 'Medium', 'Arrays', 4),
    (v_striver, 'Set Matrix Zeroes', 'set-matrix-zeroes', 'Medium', 'Arrays', 5),
    (v_striver, 'Pascal Triangle', 'pascals-triangle', 'Easy', 'Arrays', 6),
    (v_striver, 'Majority Element', 'majority-element', 'Easy', 'Arrays', 7),
    (v_striver, 'Reverse Linked List', 'reverse-linked-list', 'Easy', 'Linked List', 8),
    (v_striver, 'Detect Loop in Linked List', 'linked-list-cycle-ii', 'Medium', 'Linked List', 9),
    (v_striver, 'Flatten a Linked List', 'flatten-a-multilevel-doubly-linked-list', 'Medium', 'Linked List', 10),
    (v_striver, 'Merge Two Sorted Lists', 'merge-two-sorted-lists', 'Easy', 'Linked List', 11),
    (v_striver, 'LCA of Binary Tree', 'lowest-common-ancestor-of-a-binary-tree', 'Medium', 'Trees', 12),
    (v_striver, 'Diameter of Binary Tree', 'diameter-of-binary-tree', 'Easy', 'Trees', 13),
    (v_striver, 'Binary Tree Zigzag Level Order Traversal', 'binary-tree-zigzag-level-order-traversal', 'Medium', 'Trees', 14),
    (v_striver, 'Serialize and Deserialize Binary Tree', 'serialize-and-deserialize-binary-tree', 'Hard', 'Trees', 15),
    (v_striver, 'Number of Islands', 'number-of-islands', 'Medium', 'Graphs', 16),
    (v_striver, 'Rotten Oranges', 'rotting-oranges', 'Medium', 'Graphs', 17),
    (v_striver, 'Word Ladder', 'word-ladder', 'Hard', 'Graphs', 18),
    (v_striver, 'Dijkstra Shortest Path', 'network-delay-time', 'Medium', 'Graphs', 19),
    (v_striver, 'Binary Search', 'binary-search', 'Easy', 'Binary Search', 20),
    (v_striver, 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', 'Binary Search', 21),
    (v_striver, 'Koko Eating Bananas', 'koko-eating-bananas', 'Medium', 'Binary Search', 22),
    (v_striver, 'Climbing Stairs', 'climbing-stairs', 'Easy', 'Dynamic Programming', 23),
    (v_striver, '0 1 Knapsack', 'partition-equal-subset-sum', 'Medium', 'Dynamic Programming', 24),
    (v_striver, 'Longest Common Subsequence', 'longest-common-subsequence', 'Medium', 'Dynamic Programming', 25),
    (v_striver, 'Edit Distance', 'edit-distance', 'Hard', 'Dynamic Programming', 26),
    (v_striver, 'Subset Sum', 'target-sum', 'Medium', 'Dynamic Programming', 27),
    (v_striver, 'Trapping Rain Water', 'trapping-rain-water', 'Hard', 'Two Pointers', 28),
    (v_striver, 'Merge Intervals', 'merge-intervals', 'Medium', 'Intervals', 29),
    (v_striver, 'N Meetings in One Room', 'maximum-number-of-events-that-can-be-attended', 'Medium', 'Intervals', 30),
    (v_striver, 'Implement Trie', 'implement-trie-prefix-tree', 'Medium', 'Design', 31),
    (v_striver, 'Design a Stack with getMin', 'min-stack', 'Easy', 'Design', 32)
  on conflict do nothing;
end $$;

-- ============================================================
-- FULL LEETCODE CATALOG (synced from LeetCode GraphQL)
-- ============================================================
create table if not exists public.problems (
  title_slug text primary key,
  title text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  question_id text not null,
  paid_only boolean default false,
  topics text[] not null default '{}',
  updated_at timestamp with time zone default now()
);

create index if not exists problems_difficulty_idx on public.problems (difficulty);
create index if not exists problems_topics_gin_idx on public.problems using gin (topics);

alter table public.problems enable row level security;
create policy "Allow public read access for problems" on public.problems for select using (true);
-- Writes happen only via the service-role client / server routes (no public INSERT policy).

-- Catalog sync bookkeeping (single row)
create table if not exists public.catalog_sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamp with time zone default now(),
  total_count int default 0
);
insert into public.catalog_sync_state (id, total_count) values (1, 0) on conflict (id) do nothing;

-- Auto-mark solved from LeetCode without downgrading a manual "attempted" flag.
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
      where public.user_problem_status.status <> 'attempted'
    returning 1
  )
  select count(*) into affected from ins;
  return affected;
end $$;
