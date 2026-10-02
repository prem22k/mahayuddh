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
│  🏠 Home        │  ┌──────────────────────────────────────┐ ┌──────────────┐     │
│  🎯 Practice    │  │  Today's Battle (#15 3Sum · Medium)  │ │ Squad Streak │     │
│  🛡️ Squad       │  │  Why: 2 failed attempts on record.   │ │   14 days   │     │
│  📡 Feed        │  │  Your best 24:57       [START BATTLE]│ └──────────────┘     │
│  📓 Notebook    │  └──────────────────────────────────────┘                        │
│  ⚔️ Challenges  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────┐  │
│  🏆 Leaderboard │  │  Your Squad     │ │  Challenges     │ │  Feed              │  │
│  👤 Profile     │  │  goal ▓▓▓▓░░ 8/12│ │ 3 waiting on you│ │ @rahul solved 3sum│  │
│  ROADMAPS       │  └─────────────────┘ └─────────────────┘ └────────────────────┘  │
│  Striver SDE    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  + Create List  │  │ Arrays & Hash│ │ Two Pointers │ │  Dynamic Prog│ │ Trees & Tries│  │
│                 │  │  30 Problems │ │  20 Problems │ │  45 Problems │ │  35 Problems │  │
│                 │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  👤 Prem Sai 14d│                                     your progress + browse topics    │
├─────────────────┴────────────────────────────────────────────────────────────────────────┤
│  [⏸] 12:45 │ #15 3Sum • Medium │ [Notes] [I'm stuck] [Solved] [Failed] [Abandon]      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System & UI Architecture

1. **Floating Sidebar Dock:**
   * Inset navigation with `16px` corner radius and frosted liquid glass material (`backdrop-filter: blur(20px) saturate(180%)`).
   * Minimalist typography wordmark: **`Mahayuddh.`** with glowing crimson accent dot.
   * `⌘K` global search palette trigger with keyboard shortcuts.
   * Navigation maps to *intent*, not DB tables: **Home, Practice, Squad, Feed,
     Notebook, Challenges, Leaderboard, Profile**.
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

### Route map (current)

| Route | Surface |
|---|---|
| `/home` (and `/`) | Home — Today\'s Battle, squad, challenges, progress, feed |
| `/practice`, `/practice/[slug]` | Practice hub and problem timeline |
| `/primers`, `/primers/[slug]` | Pattern primers |
| `/patterns/[topic]` | Pattern hub |
| `/challenges`, `/c/[id]` | Challenges inbox and public deep link |
| `/squad`, `/squad/join/[code]` | Squad detail and invite landing |
| `/feed` | Activity feed (Squad / Global / Platform) |
| `/notebook`, `/approach/[id]` | Notebook, Vault tab, and approach detail |
| `/sheets/[slug]`, `/leaderboard`, `/profile` | Roadmaps, standings, profile |

`/` → `/home`, `/suggestions` → `/challenges`, `/vault` → `/notebook?tab=vault`
are permanent redirects, so old links and bookmarks keep working.

## ⚡ Core Features

### The loop
> Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return

### 1. 📊 LeetCode GraphQL Engine & Auto-Sync (`/api/sync/leetcode`)
* Queries `https://leetcode.com/graphql` directly — no third-party API.
* Fetches solved counts (E/M/H/total), contest rating + rank, daily streak, and
  the 20 most recent accepted submissions for evidence-based verification.
* Server-side cooldown via `sync_rate_limits` with a `Retry-After` header; the
  client timestamp is **never** trusted.
* **LeetCode is optional (Bible §43).** Connecting it adds an evidence badge and
  contest stats. Disconnecting it loses nothing else — no flow requires it, and
  the leaderboard is not gated on a connected handle.

### 2. 🏠 Home (`/home`, aliased at `/`)
Composed so it answers the five questions in under ten seconds:

* **Today's Battle** — one deterministic problem with a *truthful* why-list
  (low exposure, recorded failures, long gap, squad activity, goal pattern), your
  personal best, and a single `START BATTLE` CTA. After solving: the real
  duration plus four wired next actions (Explain · Challenge · Revisit · Share).
* **Your Squad** — goal progress bar or an empty state that teaches you to
  create one and invite 2–7 friends.
* **Challenges** — pending actions aimed at you.
* **Your Progress** — catalog completion across Easy/Medium/Hard.
* **Feed** — recent squad activity, generated by solves (no prose required).

### 3. 🏆 Squad Leaderboard (`/leaderboard`)
* **Squad tab first** (accountability with people you know), Global secondary.
* Sorts by any of: Total, Rating, Contests, Easy, Medium, Hard, Streak. The
  default sort is **Total**, not the synthetic "Score" — a single composite skill
  score is explicitly banned by the product bible (§22).
* Challenge any member in one tap; `?to=` deep-links the compose modal.

### 4. 🎯 Practice Hub & Problem Timeline (`/practice`, `/practice/[slug]`)
* **Review due / Weak patterns / New** sections — a simple revisit queue, not an
  SRS algorithm (§25). Pattern strength is labelled **"estimate, not proof"**.
* **Three distinct objects, never merged** (§15):
  * **Primer** — *before* solving, teaches the pattern
  * **Attempt** — *during*, your private scratchpad and battle sessions
  * **Approach** — *after*, what worked
* **Append-only timeline** per problem: attempted → solved → revisited →
  explained → challenged → completed, each with duration and confidence.
  Marking something solved on a roadmap writes a history event too.
* Hover any status cell in a roadmap for a lazy timeline preview.

### 5. ⚔️ Challenges (`/challenges`, deep link `/c/[id]`)
* "I solved X → I challenge you to solve X", with **beat-my-time** targets,
  optional deadlines, an explicit spoiler gate, and pass-along chains.
* Actions: Accept · Decline · Remind (throttled to once per 24h) · Solve ·
  Pass. Accepting attaches the battle to the challenge.
* **Deep links work for logged-out visitors**: preview → one-tap signup → straight
  into the battle, no wizard (§42).
* Completing a challenge notifies the sender.

### 6. 📚 Primers (`/primers`)
Five hand-written 8-minute pattern primers (Sliding Window, Two Pointers, Stack,
Graph BFS, 1D DP). Each has "recognise it when", a mental model, a template,
complexity, common mistakes, three starter problems, and a `START PROBLEMS` CTA.

### 7. 📓 Notebook & Vault (`/notebook`)
* **Notebook** — your personal Markdown notes, private by default.
* **Vault** — shared squad templates and guides, squad or public.
* `COPY TO MY NOTEBOOK` on any vault item, primer, or approach creates a private
  editable copy that keeps attribution ("Forked from @prem"), and the author
  sees a fork count.

### 8. 🔔 Activity & Squad (`/feed`, `/squad`)
* Feed tabs: Squad (default) · Global · Platform, with structured event cards —
  a solve, a challenge, a completion.
* Squads hold a shared goal with a progress bar, an invite link, and a member
  list with one-tap "challenge this person".

### 9. 🔍 Global `⌘K` Search
Instant search across the full catalog by title, slug, or question number.

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

The live schema is `supabase/schema.sql` (canonical, generated from the live
database) plus the versioned migrations in `supabase/migrations/`. Do not
hand-edit a migration that has already been applied — add a new one, then
regenerate `schema.sql`.

| Table | Purpose | Key constraints |
|---|---|---|
| `profiles` | User identity + synced LeetCode stats | `leetcode_username` nullable (**Step 1: LeetCode is optional**), `active_squad_id`, `objective` |
| `problems` | Full LeetCode catalog (~4k) | read-only to clients |
| `custom_lists` / `list_problems` | Curated roadmaps + squad playlists | — |
| `user_problem_status` | **Current** solve state (one row per user+slug) | tri-state: absent = unsolved |
| `problem_events` | **Append-only history** (attempted/solved/explained/revisited/failed/stuck/challenge_completed) | no UPDATE/DELETE policy — history is never rewritten |
| `battles` | Attempt sessions (`outcome`: in_progress/solved/failed/abandoned) | partial unique index enforces **one live timer per user** |
| `daily_battles` | Today's deterministic pick cache | one row per user per day |
| `squads` / `squad_members` / `squad_goals` | Small accountability groups | no client INSERT on `squad_members` — joins go through `/api/squads/join` |
| `suggestions` | Challenges v2 | sender/problem/time terms immutable after send; `suggestions_pending_unique`; remind throttled to 1/24h |
| `approaches` | "After" artifact — what worked | `visibility`: private (default) / squad / public; code capped at 20k |
| `primers` | "Before" artifact — teaches a pattern | public or squad; `fork_count` maintained by trigger |
| `notebook_notes` / `note_shares` | "Personal" knowledge + 1:1 shares | list views exclude `body_md` (§65) |
| `shared_resources` | **Vault** — shared reusable knowledge | `visibility`: squad / public |
| `feed_events` | Normalized activity (never JSON blobs) | `squad_id` is `ON DELETE SET NULL` — deleting a squad never erases history |
| `review_queue` | Revision dues (`failed`/`gap`/`weak_pattern`/`bookmark`/`low_confidence`) | materialized by trigger on battle end |
| `notifications` | Action-oriented notices with deep links | **no client INSERT** — written only by `/api/notify` |
| `analytics_events` | Funnel sink | **no client SELECT** — readable only with the service key |
| `push_subscriptions` / `sync_rate_limits` | Device push + per-user sync throttle | service-role only |

### RLS posture

Every table has Row Level Security enabled. The recurring shapes:

* **Own-row write**: `battles`, `notebook_notes`, `review_queue`, `notifications`.
* **Three-level read**: `approaches` (private own / squad via `squad_members` / public).
* **Append-only**: `problem_events`.
* **No client write at all**: `analytics_events`, `sync_rate_limits`, and
  `notifications` inserts — these are server-only by design.

---

## 🧪 Testing & CI

**Framework: `node:test`** (Node's built-in runner). Chosen over Vitest/Jest
because the suite imports the real `.ts` modules directly — Node 24 strips types
natively, so there is no build step and no test-runner dependency.

```bash
npm run test:smoke    # node --test tests/smoke.test.mjs
npm run lint          # next lint
npm run typecheck     # tsc --noEmit
npm run build         # next build (also catches App Router contract errors)
```

`tests/smoke.test.mjs` imports the **actual** modules, not copies. It covers the
contracts that silently break:

* slug guards mirroring the DB `CHECK (slug ~ '^[a-z0-9-]{1,80}$')`
* `parseProblemStatusEvent` / `toStatusMap` / `applyStatusChange`
* `safeNext` — the `?next=` open-redirect guard
* `formatDuration` — refuses to invent a duration from null/NaN
* `pickDailyBattle` — determinism, per-user variation, and **truthfulness**
  (no squad context or personal best without real data)
* the analytics event vocabulary (`lib/analyticsEvents.ts`, shared by the client
  tracker, the server allow-list, and this suite)

### CI gate

`.github/workflows/ci.yml` runs `lint → typecheck → test:smoke` on every push to
`main` and every pull request, and **blocks the merge on failure**.
`.github/workflows/sync.yml` separately runs the LeetCode cron sync.

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
SUPABASE_SECRET_KEY=your-secret-key             # server-only; bypasses RLS. Falls back to SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # legacy alias; either one works
CRON_SECRET=your-random-cron-secret-hex         # protects the background sync endpoint
LEETCODE_SESSION_SECRET=min-16-chars            # encrypts stored LeetCode session cookies
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key  # optional; for web push
VAPID_PRIVATE_KEY=your-vapid-private-key        # optional; server-only
VAPID_SUBJECT=mailto:you@example.com            # optional
NEXT_PUBLIC_SITE_URL=https://your-domain        # canonical origin for OG/sitemap
```

Generate VAPID keys with `npx web-push generate-vapid-keys`.

> **Never expose the secret key to the client.** `lib/supabase/service.ts` returns
> `null` when it is missing rather than silently degrading to the anon key, and
> every API route 500s in that case instead of quietly writing nothing.

### 3. Initialize / Migrate the Database

There are two setup paths. **Pick one** — they are not composable from empty,
because the migration chain assumes `profiles` already exists.

**A. Fresh database** — run the canonical schema in the Supabase SQL editor
(or `psql`), then seed:

```bash
# supabase/schema.sql is complete and idempotent on its own, and re-running it
# is how you repair drift. Verified by installing it three times in a row
# against a clean Postgres 17 with the anon/authenticated/service_role roles and
# the auth schema stubbed: 0 errors each time, and all 15 RPCs and 43 tables the
# app calls are present afterwards.
#
# 41 tables, 118 policies, 55 functions, 22 triggers, 2 views, RLS on all 41 tables.
#
# It is generated from the live database. After applying a migration, regenerate:
#     npx supabase db dump --file /tmp/dump.sql --schema public
#     python3 scripts/make-schema-idempotent.py   # applied to /tmp/dump.sql first
# then re-append the seed block at the bottom — a schema-only dump carries no rows.
```

**B. Existing project** — apply the versioned migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase migration list          # see what's applied vs pending
npx supabase db push --dry-run      # always dry-run first
npx supabase db push
```

> The earliest migration (`20260828000000`) already references `public.profiles`,
> so `supabase db start` / `db reset` against an empty database fails. That is
> pre-existing: the repo was bootstrapped by running `schema.sql` in the SQL
> editor, then layering migrations on top. Fixing the bootstrap chain means
> squashing migrations 1–13 into an initial snapshot, which is deliberately
> left for a separate branch rather than folded into this work.

Then seed the problem catalog and curated roadmaps:

```bash
npm run sync:catalog   # ~4k LeetCode problems
npm run sync:sheets    # NeetCode 150, Blind 75, Striver SDE
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) — `/` redirects to `/home`.

### 5. Verify Your Setup
```bash
npm run lint && npm run typecheck && npm run test:smoke && npm run build
```

All four must pass; CI enforces the first three.

## 📄 License
MIT License. Built for competitive programming developer squads.
