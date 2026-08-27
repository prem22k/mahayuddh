# ⚔️ Mahayuddh (महायुद्ध)

> **The Private DSA Arena for Developer Squads**  
> Designed with the dark, tactile aesthetic of **Apple Music Web UI**, powered by **Next.js 15**, **Supabase**, **LeetCode GraphQL Engine**, and native **PWA Web Push Notifications**.

---

## 📸 Design Inspiration (Apple Music Web UI)

The UI architecture translates the Apple Music Web layout directly into a high-performance developer workspace:

```
┌─────────────────┬────────────────────────────────────────────────────────────────────────┐
│   Mahayuddh    │ 🔍 Search problems, tags, squad...                [Squad] [All Sheets] │
│                 ├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search ⌘K   │                                                                        │
│  🏠 Arena       │  🔥 Top Picks for Squad (Hero Cards)                                   │
│  🏆 Leaderboard │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  📬 Suggestions │  │  Today POTD  │ │Streak Guardian│ │Upcoming Contest│ │ Top Suggestion │  │
│                 │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  SHEETS/ROADMAP │                                                                        │
│  📚 NeetCode150 │  🗂️ Browse DSA Topics (Category Bento Grid)                           │
│  ⚡ Blind 75    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  🎯 Striver SDE │  │  Arrays/Hash │ │  DP Patterns │ │ Graphs & BFS │ │ Binary Search│  │
│                 │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  SQUAD PLAYLISTS│                                                                        │
│  🌲 Trees & BST │  📊 Squad Tracklist Leaderboard                                        │
│  🧗 3AM Lore 🔥 │  #1  Prem Sai   🔥 14d   1920 Rating   [E:40 M:85 H:15]   [Suggest]    │
│  ➕ New List    │  #2  Rahul K    🔥 8d    1810 Rating   [E:35 M:70 H:8]    [Suggest]    │
│                 │                                                                        │
│  👤 Prem Sai 14d│                                                                        │
├─────────────────┴────────────────────────────────────────────────────────────────────────┤
│  [⏮ ⏯ ⏭] 00:24:15 │ 🟢 [Medium] 3Sum - Two Pointers (LeetCode #15) │ [Notes] [Push 🔔]  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Architecture & Aesthetics

1. **Fixed Left Sidebar (Navigation & Lists):**
   * **Brand & Search:** `⚔️ Mahayuddh` logo with `⌘K` global search button.
   * **Core Arena Tabs:** Home / Arena, Leaderboard, Suggestion Box.
   * **Curated Roadmaps (Library):** NeetCode 150, Blind 75, Striver SDE Sheet.
   * **Squad Custom Playlists:** Group-created problem sets with emoji badges (`🌲 Trees & BST`, `🧗 3AM Lore 🔥`, `➕ New List`).
   * **User Footer:** Profile avatar, LeetCode handle, and active streak flame badge.

2. **Top Picks for Squad (Hero Cards):**
   * Modeled after Apple Music’s *"Top Picks for You"*.
   * Features dynamic hero tiles: **Problem of the Day (POTD)**, **Streak Guardian Countdown**, **Upcoming Contest Alert**, and **Incoming Friend Challenges**.

3. **Category Bento Grid (DSA Topics):**
   * Modeled after Apple Music’s *"Browse Categories"*.
   * Vibrant, colorful gradient cards (*Crimson, Sunset, Purple, Emerald, Amber, Violet*) for topic mastery:
     * *Arrays & Hashing*, *Two Pointers & Sliding Window*, *Dynamic Programming*, *Graphs & BFS/DFS*, *Trees & Tries*, *Binary Search & Monotonic Stack*.
   * Displays topic completion progress (e.g. `24/30 Solved`).

4. **Tracklist-Style Squad Leaderboard:**
   * Modeled after Apple Music tracklist tables.
   * Clean, hoverable rows displaying: Rank `#`, Avatar, Name, Streak Flame 🔥, Contest Rating Sparkline, Solved Breakdown (`Easy`/`Medium`/`Hard`), and Quick Suggest Action.

5. **"Now Solving" Bottom Bar (Active Session Player):**
   * Modeled after Apple Music’s bottom player bar.
   * **Stopwatch / Timer:** Tracks active solve time with start/pause/reset.
   * **Active Problem Display:** Difficulty badge, problem title, and LeetCode link.
   * **Squad Live Presence:** Shows if friends are currently tackling the same problem.
   * **Tools:** Intuition scratchpad drawer and instant solution check.

*Complete token specification and component rules: [design.md](file:///home/premsaik/Desktop/Projects/mahayuddh/design.md)*

---

## ⚡ Core Features

### 1. 📊 LeetCode GraphQL Engine
* Fetches Easy / Medium / Hard counts, acceptance rates, global rank, active streak calendar, contest ratings, and recent 20 accepted submissions directly from `https://leetcode.com/graphql`.
* Caches responses with stale-while-revalidate for fast rendering and zero rate-limiting issues.

### 2. 📬 "Approach First" Suggestion Box
* Challenge any friend to a specific LeetCode problem.
* Attach a 3-line intuition note (e.g., *"Notice how you can reduce 2D DP to 1D with a rolling array"*).
* **Auto-Verification:** The background sync monitors the friend's accepted submissions and automatically marks the challenge as completed.

### 3. 📚 Curated Sheets & Squad Playlists
* Built-in roadmaps: **NeetCode 150**, **Blind 75**, **Striver SDE Sheet**.
* Squad lists: Create custom lists (e.g., *"Meta 2026 High Frequency"*).
* Real-time squad progress matrix showing who has solved which question.

### 4. 🗃️ Squad Resource Vault
* Pin algorithm templates (Monotonic Queue, Union-Find, Dijkstra).
* Share company interview debriefs and OA question logs.

### 5. 📱 PWA & Web Push Notifications
* Installable as a native standalone PWA on iOS (Safari 16.4+) and Android.
* **Push Notifications:**
  * 🔥 *Streak Guardian (9:30 PM):* Alert before midnight if daily streak is at risk.
  * 📬 *New Suggestion:* Push alert when a friend challenges you.
  * 😤 *Friend Nudges:* Nudge inactive friends with 1 tap.
  * 🏆 *Contest Deltas:* Rating changes delivered post-contest.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router, Server Actions, React 19) |
| **Styling** | Tailwind CSS v4 + Radix UI + Lucide Icons (Apple Music Tokens) |
| **Database & Auth** | Supabase (PostgreSQL 16 + Row Level Security + Realtime) |
| **PWA & Web Push** | Service Worker + Web Push API (`web-push` VAPID) |
| **Data Source** | LeetCode Public GraphQL API |
| **Hosting** | Vercel (Hobby Tier) |

---

## 🗄️ Database Schema

```sql
-- 1. Profiles & Synced LeetCode Stats
create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  leetcode_username text unique not null,
  avatar_url text,
  contest_rating float default 1500,
  global_rank int,
  streak int default 0,
  total_easy int default 0,
  total_medium int default 0,
  total_hard int default 0,
  last_synced_at timestamp with time zone
);

-- 2. Custom Squad Lists / Playlists
create table custom_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text default '📁',
  description text,
  is_curated boolean default false,
  created_by uuid references profiles(id)
);

create table list_problems (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references custom_lists(id) on delete cascade,
  title text not null,
  title_slug text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  category text
);

-- 3. Suggestions
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references profiles(id),
  to_user uuid references profiles(id),
  problem_slug text not null,
  problem_title text not null,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  note text,
  status text default 'pending' check (status in ('pending', 'completed', 'dismissed')),
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- 4. Push Subscriptions
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/mahayuddh.git
cd mahayuddh
npm install
```

### 2. Configure Environment (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@mahayuddh.app
```

### 3. Run Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) to enter the Arena.

---

## 📄 License
MIT License. Built for developer squads aiming for top-tier software engineering roles.
