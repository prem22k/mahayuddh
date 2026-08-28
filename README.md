# ⚔️ Mahayuddh. (महायुद्ध)

> **The Private DSA Arena for Developer Squads**  
> Designed with the dark, tactile aesthetic of **Apple Music Web UI**, powered by **Next.js 15 App Router**, **Supabase**, **LeetCode GraphQL Engine**, and interactive solving session controls.

---

## 📸 Layout & Design Philosophy

Mahayuddh takes inspiration from the **Apple Music Web Player** and elevates it into a high-performance, dark-mode competitive programming arena:

```
┌─────────────────┬────────────────────────────────────────────────────────────────────────┐
│  Mahayuddh.     │ 👤 Prem Sai (active)                              🔄 Sync  🔔 Alerts  │
│                 ├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search ⌘K   │                                                                        │
│  🏠 Arena       │  🔥 Top Picks for Squad (Daily Highlights)                             │
│  🏆 Leaderboard │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  📬 Suggestions │  │  Today POTD  │ │Streak Guardian│ │Contest Arena │ │Suggestion Box│  │
│  🗃️ Vault       │  │ #15 3Sum     │ │   14 Days    │ │ 1920 Rating  │ │  3 Challenges│  │
│                 │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  ROADMAPS       │                                                                        │
│  NeetCode 150   │  🗂️ Browse Topics (Dynamic Database Categories)                        │
│  Blind 75       │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  Striver SDE    │  │ Arrays & Hash│ │ Two Pointers │ │  Dynamic Prog│ │ Trees & Tries│  │
│                 │  │  30 Problems │ │  20 Problems │ │  45 Problems │ │  35 Problems │  │
│  SQUAD LISTS    │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  + Create List  │                                                                        │
│                 │                                                                        │
│  👤 Prem Sai 14d│                                                                        │
├─────────────────┴────────────────────────────────────────────────────────────────────────┤
│             [⏮ ⏯ ⏭] 00:12:45 │ #15 3Sum • Medium (Two Pointers) │ [Notes] [Mark Solved]  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System & UI Architecture

1. **Floating Sidebar Dock:**
   * Inset navigation with `16px` corner radius and frosted liquid glass material (`backdrop-filter: blur(20px) saturate(180%)`).
   * Minimalist typography wordmark: **`Mahayuddh.`** with glowing crimson accent dot.
   * `⌘K` global search palette trigger with keyboard shortcuts.
   * Navigation links for **Arena**, **Leaderboard**, **Suggestions**, and **Vault**.
   * Curated roadmaps and user-created custom squad playlists.
   * Profile card with user avatar (or initial fallback), handle, active streak, and sign-out hook.

2. **Compact Floating Bottom Player Dock (Apple Music Chrome Player):**
   * Centered pill capsule dock (`max-width: 680px`, `56px` height, `border-radius: 9999px`).
   * **Active Stopwatch Timer:** Live count-up stopwatch with pause, play, and reset controls.
   * **LCD Problem Metadata:** Displays active problem `#number`, title, difficulty badge, category, and session status.
   * **Problem-specific Scratchpad:** In-dock markdown notes drawer that auto-saves intuition, time/space complexity, and edge cases to local storage keyed by problem slug.
   * **Direct LeetCode Action:** One-tap link to problem on LeetCode and **Mark Solved** action with confetti celebration.
   * **Clean Idle State:** When no problem is selected, displays an idle prompt with quick search activation.

3. **High-Contrast Dark Aesthetic:**
   * OLED True Black background (`#000000`), dark glass elevations (`#1c1c1e`, `#2c2c2e`), and vibrant category gradients (*Crimson, Sunset, Royal, Purple, Emerald, Amber, Violet, Rose*).
   * Clean typography-driven layouts without AI-slop emoji clutter.

---

## ⚡ Core Features

### 1. 📊 LeetCode GraphQL Engine & Auto-Sync
* Direct integration with `https://leetcode.com/graphql` querying live stats without third-party API dependencies.
* Fetches:
  * **Solved Problem Counts:** Easy, Medium, Hard, and Total solved.
  * **Contest Metrics:** Contest rating, global ranking, and top percentage.
  * **Daily Streak Calendar:** Continuous active streak days and active calendar history.
  * **Recent Submissions:** Recent 20 accepted submissions for automated verification.
* Manual and automatic background synchronization via [`/api/sync/leetcode`](app/api/sync/leetcode/route.ts).

### 2. 🏠 Dynamic Arena Dashboard (`/`)
* **Active User Badge:** Shows logged-in user profile avatar, username, and active green online indicator.
* **Deterministic Problem of the Day (POTD):** Auto-selects a daily featured problem from the database with one-click "Start Solving" dock activation.
* **Streak Guardian:** Aggregates cumulative squad streaks and highlights the leading member.
* **Contest Standings Card:** Highlights peak squad contest rating.
* **Suggestion Box Card:** Real-time count of pending peer challenges.
* **Dynamic Topic Bento Grid:** Category cards extracted dynamically from indexed database problems with live problem counts and mathematical SVG vector patterns.

### 3. 🏆 Tracklist Squad Leaderboard (`/leaderboard`)
* **Personal Standing Ribbon:** Top hero banner displaying the logged-in user's squad rank (`#1 in Squad`), contest rating, active streak, solved breakdown (`E / M / H`), and instant **"Sync Stats"** button.
* **LeetCode Handle Connector:** In-app connection form for users who have not yet linked their handle.
* **Multi-Metric Sorting Tabs:** Filter standings by *Contest Rating*, *Daily Streak*, *Hard Solved*, or *Easy Solved*.
* **Personalized Highlight:** Authenticated user row is highlighted with a crimson border and bold `"YOU"` badge.
* **Peer Challenge Action:** One-tap button to challenge any squad mate.

### 4. 📚 Roadmaps & Squad Playlists (`/sheets/[slug]`)
* **Standard Curated Roadmaps:** **NeetCode 150**, **Blind 75**, and **Striver SDE Sheet**.
* **Squad Custom List Creator:** Interactive modal allowing squad members to create custom problem sheets with live problem search and multi-selection.
* **Interactive Problem Table:**
  * Category filter pills and instant search.
  * One-click "Start Session" loading problems directly into the bottom player dock.
  * Solved status toggles persisted to Supabase `user_problem_status`.
  * Direct LeetCode external links.

### 5. 📬 Approach-First Suggestion Box (`/suggestions`)
* Challenge any squad mate to solve a specific LeetCode problem.
* Attach a 3-line intuition note or hint without spoiling the solution.
* **Auto-Verification:** The background sync (`.github/workflows/sync.yml`, gated by `CRON_SECRET`) monitors recent accepted submissions on LeetCode and automatically verifies received challenges for the configured squad handle.

### 6. 🗃️ Squad Resource Vault (`/vault`)
* Centralized hub for sharing algorithm code templates (Union-Find, Dijkstra, Monotonic Stack, Segment Tree).
* Interview debriefs and cheat sheets across Template, Interview Log, Cheat Sheet, and Article categories.

### 7. 🔍 Global `⌘K` Search Modal
* Instant problem search across all indexed roadmap questions by title, category, or problem number.
* Launch active solving session directly from search results.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15.2+ (App Router, React 19) |
| **Styling** | Tailwind CSS v3.4 + Glassmorphism Custom Properties + Lucide Icons |
| **Database & Auth** | Supabase (PostgreSQL 17 + Row Level Security) |
| **Data Engine** | LeetCode Public GraphQL API |
| **State Management** | React Context (`AuthProvider`, `SolvingProvider`) + LocalStorage Persistence |
| **Deployment** | Vercel (Edge Middleware for auth session refresh) |

---

## 🗄️ Database Schema

```sql
-- 1. Profiles & Synced LeetCode Stats
create table public.profiles (
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

-- 2. Custom Squad Lists & Roadmaps
create table public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  emoji text default '📁',
  description text,
  is_curated boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- 3. List Problems
create table public.list_problems (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.custom_lists(id) on delete cascade not null,
  title text not null,
  title_slug text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  category text not null,
  order_index int default 0
);

-- 4. User Problem Status (Solve Matrix)
create table public.user_problem_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null,
  status text check (status in ('solved', 'attempted')) default 'solved',
  notes text,
  solved_at timestamp with time zone default now(),
  unique (user_id, problem_slug)
);

-- 5. Suggestions (Peer Challenges)
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references public.profiles(id) on delete cascade not null,
  to_user uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null,
  problem_title text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')) not null,
  category text not null,
  note text,
  status text check (status in ('pending', 'completed', 'dismissed')) default 'pending',
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- 6. Shared Resources (Vault)
create table public.shared_resources (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  category text check (category in ('Template', 'Interview Log', 'Cheat Sheet', 'Article')) not null,
  content text not null,
  external_url text,
  created_at timestamp with time zone default now()
);

-- 7. PWA Push Subscriptions (provisioned; UI not yet wired)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

-- 8. Live Squad Feed Events (provisioned; UI not yet wired)
create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text check (event_type in ('solved', 'streak', 'contest', 'suggested', 'completed')) not null,
  problem_title text,
  problem_slug text,
  difficulty text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
```

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/prem22k/mahayuddh.git
cd mahayuddh
npm install
```

### 2. Configure Environment (`.env.local`)
Create a `.env.local` file with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only; used by the cron sync endpoint
CRON_SECRET=your-random-cron-secret-hex           # protects the background sync endpoint
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key  # optional; for web push
VAPID_PRIVATE_KEY=your-vapid-private-key          # optional; server-only
```

### 3. Initialize Supabase Database
Run the SQL queries in [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor to configure tables, Row Level Security (RLS) policies, and seed curated roadmaps.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to enter the Arena.

---

## 📄 License
MIT License. Built for competitive programming developer squads.
