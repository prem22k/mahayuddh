-- ============================================================
-- MAHAYUDDH: CATALOG & PROFILE EXTENSIONS
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/purvcivaijjjtgknqvqn/sql
-- ============================================================

-- 1. Profiles Table Updates
alter table if exists public.profiles alter column leetcode_username drop not null;
alter table if exists public.profiles add column if not exists leetcode_session_encrypted text;
alter table if exists public.profiles add column if not exists leetcode_session_synced_at timestamp with time zone;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2. Full LeetCode Problems Catalog
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
drop policy if exists "Allow public read access for problems" on public.problems;
create policy "Allow public read access for problems" on public.problems for select using (true);

-- 3. Catalog Sync State Bookkeeping
create table if not exists public.catalog_sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamp with time zone not null,
  total_count int not null default 0
);

alter table public.catalog_sync_state enable row level security;
drop policy if exists "Allow public read access for catalog_sync_state" on public.catalog_sync_state;
create policy "Allow public read access for catalog_sync_state" on public.catalog_sync_state for select using (true);
