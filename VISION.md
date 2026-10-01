# Mahayuddh — Complete Product Vision, Ideation Record & Build Plan

> **Status:** Accepted ideation (build-ready, not yet implemented unless noted)
> **Date:** 2026-09-30 (covers full chat history to this date)
> **Author intent:** Free public product, launched on LinkedIn. Private-squad accountability + community teaching for DSA developers.
> **Positioning:** NeetCode tells you what to solve. LeetCode judges it. Mahayuddh makes sure you show up — with your squad, and with the best community teachers.
> **This document's promise:** every prompt from the founder in this chat is captured below verbatim-in-spirit, then polished into a rational spec. Nothing dropped. See §14 Prompt-to-Decision traceability.

---

## Table of contents

0. Current state of the product — features, tech stack, hosting (§0)
1. Origin + launch intent (§1)
2. Build audit + can it get users (§2)
3. Differentiation — "why yours when clones exist" (§3)
4. Notes: private default, folders/patterns, 1:1 + squad share (§4)
5. Challenge = async suggest (§5)
6. Leaderboards: squad + global (§6)
7. Feed + chat: squad + global, user posts, platform updates, contest cron (§7)
8. Squads as real groups + full schema change (§8)
9. Schema: optimal squad-aware design, free-tier math, stress/smoke (§9)
10. Multi-squad vs single, feed retention/JSON, big notes with links/code (§10)
11. Optimal free stack (Supabase vs alternatives) (§11)
12. Existing solutions teardown — how well each does it (§12)
13. Realtime co-edit: rejected (§13)
14. Prompt-to-Decision traceability (§14)
15. Learner needs: what a DSA learner actually requires (§15)
16. Pattern primers (the ChatGPT Arrays+Hashing insight) (§16)
17. Community: best teach via feed/notes/links/videos (§17)
18. LinkedIn + Threads mechanics research (post types + graph) (§18)
19. Feed as DSA social media: innovative growth design (§19)
20. Final data model, RLS, build order, non-goals, success checks (§20)

---

## 0. Current state of the product (as of 2026-09-30, pre-vision build)

**Founder prompt:** "what the current state of the product is? like what features are there. what techstack, what hosting. we are using vercel for frontend. and everything else is supabase."

### 0.1 What exists today (shipped, working)

Routes (all behind auth except `/login`; anon `/*` → `/login` via middleware):
- `/` Arena dashboard — POTD (deterministic daily pick), Streak Guardian, Contest Standings card, Suggestion Box count, Topic Bento grid from live catalog, Your Progress strip, Warrior Dossier modal, Connect LeetCode modal.
- `/leaderboard` — squad (actually global, see §8) tracklist board, 8 sortable metrics (score/rating/contests/easy/med/hard/total/streak), personal standing ribbon, handle connect form, Sync Stats, Dossier inspect, Challenge shortcut to `/suggestions?to=`.
- `/suggestions` — async peer challenges (create/target/difficulty/slug/note, pending/completed tabs, Solve-in-Dock, assignee-only LeetCode-proofed complete, duplicate guard).
- `/sheets/[slug]` — NeetCode 150 / Blind 75 / Striver SDE + custom squad lists (create modal, category filters, search, Start Session into dock, solved toggles → `user_problem_status`, LeetCode links).
- `/vault` — shared templates / interview logs / cheat sheets / articles (CRUD owner-only, copy button, search + category tabs).
- `/login` — email+password + squad name + LeetCode handle signup, email-confirm branch. No OAuth yet.
- Global `⌘K` search modal, Now-Solving bottom dock (stopwatch play/pause/reset, problem LCD, per-problem scratchpad in `localStorage`, LeetCode link, Mark Solved + confetti, 20s background AC auto-detect poll), sidebar/header AppShell, PWA manifest + icons + prod-only service-worker register.

APIs:
- `POST /api/sync/leetcode` — live LeetCode GraphQL sync (counts, contest rating/rank/top%, streak calendar, recent 20 AC), 60s/user cooldown (`sync_rate_limits`), 1.5s cron politeness, chunked upserts, service-role writes.
- `GET/POST /api/sync/catalog` — full ~3.5k-problem catalog scrape (reads never mutate; cron POST only).
- `POST /api/sync/leetcode-history` + `/api/sync/solved-slugs` — full-history import via session cookie/password (Cloudflare-failure aware, cookie-paste fallback).
- `POST /api/sync/seed-sheets` — curated roadmap seeding (service-role bypasses RLS).
- `GET/POST /api/auth/profile` — profile resolve (Bearer→cookie fallback).
- Cron: `.github/workflows/sync.yml` every 3h gated by `CRON_SECRET`.

Database (Supabase Postgres 17, RLS on): `profiles` (stats + encrypted session, anon/auth revoked on session col), `custom_lists`, `list_problems`, `user_problem_status` (solved/attempted + unused `notes` col), `suggestions` (pending unique guard, parties immutable), `shared_resources`, `push_subscriptions` (provisioned, UI not wired), `feed_events` (provisioned, zero writers/UI), `problems` (catalog, service-role writes only), `catalog_sync_state`, `sync_rate_limits` (no client access). 8 migrations through `20260916000003` (catalog, squad multiuser RLS, initplan/dedupe fixes, contest metrics, trust boundaries ×2, rate limit). Seed: 3 curated lists + ~100 real-slug problems. RPC `mark_solved_from_leetcode()` (promote attempted→solved only) + `preserve_attempted` + `lock_suggestion_parties` triggers.

### 0.2 Tech stack (pinned)

- Framework: Next.js `^15.2.0` App Router + React `^19.0.0` / `react-dom` + TypeScript `^5.8.2` (strict, `tsc --noEmit` clean).
- Styling: Tailwind `^3.4.17` + PostCSS + `clsx` + `tailwind-merge`, custom Apple-Music glass tokens, `lucide-react ^1.16.0`.
- Backend/BaaS: Supabase only — Postgres 17 + Auth (SSR `@supabase/ssr ^0.5.2`, `supabase-js ^2.49.1`) + RLS + Storage (1GB free, unused for product data today) + Realtime (enabled, unused for feed) + Edge Runtime enabled (no functions deployed; sync is Next.js routes + GitHub cron, not edge functions).
- Misc: `canvas-confetti`, `web-push` (+ `@types`), ESLint `next/core-web-vitals`, no test runner, no markdown renderer, no analytics, no Sentry.
- Data engine: unofficial LeetCode GraphQL + `/api/problems/algorithms` scrape (no key, Referer/UA spoof, fragile by nature).

### 0.3 Hosting + ops (current)

- Frontend: **Vercel** (Next.js build `next build`, edge middleware for auth refresh). No custom server.
- Everything else: **Supabase Cloud free tier** (single project `mahayuddh`): Postgres + Auth + Storage + Realtime. Local dev via Supabase CLI (`supabase/config.toml`, project_id `mahayuddh`, API :54321 / DB :54322 / Studio :54323, seed `./seed.sql`). 2-project free limit, 500MB DB / 5GB+5GB egress / 50k MAU / 200 realtime conns / 2M msgs / 500k edge invocations, pause after 1wk idle — no backups/PITR on free.
- Secrets: `.env.local` (gitignored) + `.env.example` placeholders (`NEXT_PUBLIC_SUPABASE_URL`, anon/publishable keys, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, VAPID pair, `LEETCODE_SESSION_SECRET`). No hardcoded secrets in source.
- Gaps vs vision: no `squads/squad_members`, no notebooks/shares, no feed UI/writers, no invites, no OAuth, no landing page, no OG/robots/sitemap, no analytics/feedback, no `error.tsx`, no CI gate, `scripts/sync.mjs` gitignored.

---

## 1. Origin + launch intent

**Founder prompt:** "planning on launching this project as a product i made for fun on my linkedin so that people can use it for free."

Intent locked:
- Free forever core (mirrors YeetCode's "duels/boards free forever" promise, not LeetCode Premium $35/mo).
- LinkedIn launch to cold traffic (not just 5 known friends on WhatsApp).
- Fun project → real product without losing soul: dark Apple-Music aesthetic, squad guilt loop, no enterprise bloat.
- Implication accepted: LinkedIn cold traffic bounces on login walls, so public landing + demo squad + shareable proof cards are launch-blockers (see §2).

---

## 2. Build audit + can it get users

**Founder prompt:** "audit how well this is made, and whether this can actually get many users on the product."

### 2.1 Engineering audit (verified: `npx tsc --noEmit` clean, no hardcoded secrets, middleware + layout + arena + leaderboard + suggestions + vault + schema read)

Stack: Next.js 15 App Router + React 19 + Supabase SSR + Tailwind 3.4 + web-push + canvas-confetti + lucide.

Genuinely good:
- Auth/RLS above hobby-grade: middleware session refresh + protected redirect (`lib/supabase/middleware.ts`), callback open-redirect guard, ownership checks, slug regex, LIKE-escape, CORS allowlist (leetcode.com + own site, never `*`).
- Trust boundary real: `leetcode_session_encrypted` revoked from anon/authenticated, `grant update (username, avatar_url)` only, `mark_solved_from_leetcode()` SECURITY DEFINER RPC + `preserve_attempted` trigger, suggestion parties immutable, stats monotonic (`Math.max`), never-competed stays `null` not fake 1500.
- LeetCode resilience thoughtful: `AbortSignal.timeout`, revalidate cache, null vs not-found, 1.5s cron politeness, 60s/user cooldown, chunked upserts (500/300/50), partial-catalog never marked complete.
- PWA baseline: `app/manifest.ts`, icons, prod-only `PwaRegister`, `sw.js` network-first + push. Mobile drawer + bottom-dock offsets, `role=alert/table`, `aria-live`, sort `aria-label`s.

Critical bugs/risks (ship-blocking):
1. Double-fetch: `app/leaderboard/page.tsx:86-92` two identical `useEffect(load, [])` — delete one.
2. `sw.js` caches every GET incl. `/api/*` + cross-origin, no TTL; `STATIC_ASSETS` lists `/globals.css` which isn't a public URL. Scope to navigations/static + destination/URL filter.
3. Cooldown-burn mismatch `app/api/sync/leetcode/route.ts:411-419` — comment says 403/404 don't burn cooldown but upsert runs before fetch, so 404 burns 60s. Move stamp after success or fix comment.
4. Silent-empty helpers (`getSquadProfiles`, `searchCatalogProblems`, `getUserStatusesBySlugs` return `[]` on error) — UI can't tell "no data" from RLS/network failure.
5. Undocumented-endpoint dependence (`/api/problems/algorithms` + password-login CSRF regex) — no contract test, no cron `failed[]` alerting.
6. Minor: manifest `theme_color #121212` vs layout `#000000` mismatch; `PwaRegister` on `window load` only (misses late load — use idle/direct guard).
7. Missing must-haves: zero tests (`**/*.test.*` = none), SEO only title+desc (no OG/Twitter/canonical/robots/sitemap/JSON-LD), `viewport maximumScale:1, userScalable:false` blocks pinch-zoom (WCAG 1.4.4 — remove), `text-white/40` contrast audit needed, no `error.tsx`/`global-error.tsx`/Sentry, no lint/tsc/build CI gate, `scripts/` gitignored so `sync:*` scripts fail on fresh clone.

### 2.2 Growth audit verdict: well-built fun squad project (7/10 eng, 4/10 prod). NOT ready for open LinkedIn free launch.

- ICP: 3rd/4th-year Indian college peer group (3-10 friends) co-prepping placements, already on LeetCode. Secondary: placement cells/coding clubs. Non-ICP: solo grinders, Codeforces racers, non-LeetCode users, recruiters.
- Value-prop scores: squad leaderboard auto-sync 8/10, roadmaps in one UI 7/10, peer challenges auto-verified 7/10, Now-Solving dock (timer+notes+AC auto-detect) 8/10, Vault 4/10 (Notion parity), Dossier/Radar 4/10 (eye candy).
- Launch killers: login wall (`/*` → `/login` anon, zero value prop/screenshots/proof — ~95% bounce), 4-field signup + email-confirm + scary cookie/password tabs (no Google/GitHub OAuth), depressing single-player empty state (leaderboard of 1, `IDLE`, 0 suggestions, no demo squad, no invite flow — `grep invite|share|referral` = zero), no SEO/analytics/shareable artifact/feedback loop, LeetCode scrape fragility at scale (1k users ≈ 25min/cron run, 10k = ban; 60s cooldown angers spikes).
- Cost: Supabase/Vercel free fine to ~500-1k users. Blocker is distribution + trust, not infra bill.
- Prescription: closed beta to 5-10 known squads via WhatsApp first; 2-week sprint before LinkedIn — public `/` landing + `/arena` app, Google OAuth + demo squad, `/join/:code` invites + dossier share image, OG/sitemap/PostHog/feedback, handle-only sync with backoff + status page.

---

## 3. Differentiation — "why yours when clones exist"

**Founder prompt:** "wont people think products like these already exist so why should we use yours?"

Answer: yes, they will — and half-right. Don't launch as "another LeetCode tracker."

Market truth (researched §12): LeetCode = bank + judge, NeetCode = curated 150 + videos, neither does squads. Direct squad clones already exist (YeetCode duels/XP, DSABuddy campus boards, LeetLeague clans+chat, Friends Leaderboard rooms, LeetGrind snapshots). "DSA leaderboard with auto-sync" gets "already exists" comments.

Wedge (only defensible):
- **Now-Solving dock:** timer + scratchpad + 20s AC auto-detect while solving (`NowSolvingBar.tsx`). Nobody does session-based solving, only post-hoc stats.
- **Approach-first challenges:** problem + 3-line intuition, auto-verified via recent AC. YeetCode does duels; you do peer-teaching.
- **Private 3-10 guilt loop:** Streak Guardian + combined fire, not global fame.

LinkedIn positioning: "Private accountability dock for college squads, not another roadmap. NeetCode tells you what to solve, LeetCode judges it, Mahayuddh makes sure you actually show up with friends." Explicitly NOT building judge/videos/company-tags/global board — say it in the post to disarm comparison.

---

## 4. Notes: private default, folders/patterns, 1:1 + squad share

**Founder prompts:** "shared notes or private notes inside squads" → clarified "notes default is private, and if shared can be shared, and the notes im talking about is where you can manage your own notes as per categories in folders or for patterns, which you might wanna share with friends so that they can read it and learn" → clarified "both if they want to share to particularly someone yes, if entire squad also yes" + "both yes" (catalog topics + custom folders).

Final spec:
- **Private by default.** Sharing is explicit opt-in, reversible (unshare revokes).
- **Organization both:** custom folders (`Placements`, `Graphs grind`) AND pattern tags (autocomplete from catalog topics `Sliding Window` + allow custom). Folders = strict mental model for students; tags = cross-cutting filter. Both, as founder demanded.
- **Share both scopes:** (a) 1:1 to a specific mate via `note_shares(note_id, shared_with_user_id)`, (b) whole squad via `visibility=squad`. Read + copy only, no co-edit v1.
- **Content:** markdown with links + fenced code (see §10). No separate fields needed.
- **Why it wins:** note lives next to solve status + dock timer; shared approach appears in context of the exact challenged problem. Notion can't do that.
- **Current-gap fix:** dock scratchpad is `localStorage`-only and never syncs; `user_problem_status.notes` exists but unused AND public-readable (leak — must make owner-only, see §9); Vault is public-only no folders. So new `note_folders + personal_notes + note_shares` tables, Vault untouched.

---

## 5. Challenge = async suggest (locked)

**Founder prompt:** "maybe u challenging your teammate" → clarified "by challenge i meant async for ex i solved a question and i want to challenge my friend to solve it as well or you can say suggest."

Locked definition: `I solved X → challenge friend to solve X`. No live duel, no timer, no XP/wager v1.

Reuse `suggestions(from_user, to_user, squad_id new, problem_slug, problem_title, difficulty, note, status pending|completed|dismissed)` with existing guards (`suggestions_pending_unique`, assignee-only completion with LeetCode proof in `markSuggestionCompleted`). Only work: add `squad_id`, scope queries to squad, add entry points (sheet row `Solved → Challenge friend`, dock `Solved → Challenge friend?` prompt). Timed duels explicitly out.

---

## 6. Leaderboards: squad + global (both, different jobs)

**Founder prompt:** "and a global leaderboard as well."

- **Squad board (default):** guilt + teaching. Dense ranks, `YOU` highlight, Challenge action. Scoped to selected squad. This is the home view.
- **Global board:** aspiration + discovery. Paginated, `Linked only` filter, no challenge button. Uses global `profiles` (no `squad_id`).
- Never merge: merged board demotivates beginners facing 2100-rated grinders.
- Truth today: `getSquadProfiles()` selects ALL profiles (no `squads` table), so "squad" board is actually global. True split requires §8 migration.

---

## 7. Feed + chat: squad + global, user posts, platform updates, contest cron

**Founder prompts:** "maybe some kind of feed for dsa enthuasists" → "maybe feed both squad and global or squad and global chat as well. what do you say" → "its upto them if they want to post they post otherwise no, i mean we can use the feed to post updates abt the platform. and also a cronjob for contests reminders ig?"

Final decisions:
- **Squad feed: yes.** Auto events first (`solved, streak, contest, suggested, completed, note_shared new`) via writers on existing actions. High signal, zero effort, makes 5-person squads feel alive. `feed_events` table already provisioned, zero writers — wire it.
- **Global feed: yes, but discovery-first.** User posts opt-in (author picks squad|global at post time) + auto-aggregated top solves (read-heavy, no posting pressure). If everyone can post globally day 1 with 20 users → ghost town + spam. So global = read by default, write opt-in.
- **Platform updates: yes.** `feed_posts(author_id null = platform, scope global)` — e.g. "Notebooks shipped". Founder posts via DB insert v1, tiny admin UI later.
- **Contest reminders cron: yes.** New `contests(id, source, title, starts_at, url)` + daily workflow (LeetCode GraphQL contest list, hardcoded Sat 8pm IST / Sun 8am IST fallback). Cron inserts platform `feed_posts scope=global "Weekly Contest in 24h"` + squad `feed_events type=contest`. Feed card first, web-push (`push_subscriptions` already provisioned, bell currently local-only in `Header.tsx`) second.
- **Chat: no global chat.** Needs Realtime presence + moderation + report/block. Ghost-town chat kills credibility worse than no chat. Replace with async comments on challenges/notes (`suggestion_comments`, `note_comments`) — same social hit, 10x cheaper, no moderation queue. Squad comments yes, global chat no.

Single `/feed` with tabs `Squad | Global | Platform`. Empty states with CTA, never blank.

---

## 8. Squads as real groups + full schema change

**Founder prompt:** "squads means some group of people as a group not everyone who logged in the platform. we will make seperate tables, entire schema has to update for this big change."

Accepted: squad = first-class primitive. Today no squad concept — `profiles/suggestions/feed_events` global, "squad leaderboard" actually global.

Target:
- `squads(id, name, invite_code unique 8-char, created_by, created_at)`
- `squad_members(squad_id, user_id, role admin|member, joined_at)` — `pk(squad_id, user_id)`
- Add `squad_id` to `suggestions`, `personal_notes` (new), `feed_events`, `feed_posts` (new). Keep `profiles` global for global board.
- One write = one squad. No cross-posting. User can join N squads, each challenge/note/post belongs to exactly one (see §10 for single-active UX).
- Invites: code-based `/join/:code`. Any member can invite with code v1 (revisit admin-only later). Migration backfills all existing users into `General` squad so nothing breaks.
- RLS flips `public read` → `private = owner-only, squad = member-of-that-squad read, public = anon read`, table by table (see §9, §20).

---

## 9. Schema: optimal squad-aware design, free-tier math, stress/smoke

**Founder prompt:** "brainstorm and curate the best possible db schema which would be the optimal approach so later we wont have to worry about it again. i want you to stress test it and smoke test it. since i will be using supabase free tier only. you can access supabase via npx supabase from cli."

Free ceiling designed against: 500MB DB / 5GB + 5GB cached egress / 50k MAU / 200 realtime conns / 2M realtime msgs / 500k edge invocations / 1GB storage / pause after 1wk idle / 2 active projects.

### 9.1 Final table set (15 tables, no more v1)

Keep: `profiles` (global, no squad_id), `problems` (catalog, service-role write only), `custom_lists`, `list_problems`, `user_problem_status`, `suggestions` + `squad_id`, `shared_resources` (Vault unchanged), `push_subscriptions`, `feed_events` + `squad_id`, `catalog_sync_state`, `sync_rate_limits` (service-role only, no client access).

New: `squads`, `squad_members`, `note_folders`, `personal_notes`, `note_shares`, `feed_posts`, `contests`, `suggestion_comments`, `note_comments` (full DDL in §20).

Decisions: no co-edit notes (read+copy only), no global chat table, Vault separate from Notebooks (mixing public + private RLS tangles), `suggestions.squad_id NOT NULL` after backfill / `personal_notes.squad_id NULL` allowed (pure private) / `feed_events.squad_id NULL` = global contest event.

### 9.2 Size math (why it fits 500MB)

| Table | Worst realistic | Size | Verdict |
|---|---|---|---|
| `problems` 3.5k | fixed | ~0.8MB | fine |
| `profiles` 2k | 2k × 250B | ~0.5MB | fine |
| `user_problem_status` 2k×300 | 600k × 120B | ~72MB | largest, OK (solved+attempted only) |
| `personal_notes` 2k×20 × 4KB | 40k rows | ~160MB | cap `content_md ≤ 50k chars` + 5MB/user quota, else blows budget |
| `feed_events` unbounded | 10k/day | explodes | TTL 90d cron delete + `(squad_id, created_at desc)` index + 20/page, no Realtime |
| suggestions/comments/posts | low | <10MB | fine |

Rules: CHECK `octet_length` caps everywhere, explicit column selects (never `select *` on feed/notes), `max_rows=1000` stays, keyset pagination.

### 9.3 RLS + index pattern (perf-safe, researched §11)

- Helper `is_squad_member(sid)` as `plpgsql SECURITY DEFINER STABLE` (not `sql` — `sql` inlines and triggers infinite-recursion detection), `(select auth.uid())` everywhere, separate policy per op, `WITH CHECK` on all writes (missing it lets reassignment attacks through).
- Private notes owner-only; squad notes `visibility='squad' AND is_squad_member(squad_id)`; 1:1 `exists (note_shares...)`; public anon read for future `/n/:id`.
- Fix existing leak in same migration: `user_problem_status` public-read → status row squad-readable, `notes` column owner-only (column revoke like `leetcode_session_encrypted`).
- Indexes `if not exists`: `squad_members(user_id)`, `(user_id, squad_id)`, `suggestions(squad_id, created_at desc)`, `personal_notes(owner_id, updated_at desc)` + `(squad_id, visibility)`, `note_shares(shared_with_user_id)`, `feed_events/feed_posts(squad_id, created_at desc)`, `problems(topics gin)` existing.
- Optimized RLS overhead +50-80% (3ms→5ms OK); naive 10-20x. Denormalize `squad_id` on child tables (no JOIN in policy).

### 9.4 Stress + smoke (read-only via CLI today, executable in build)

```bash
npx supabase status
npx supabase migration list
npx supabase db lint --linked   # initplan + RLS warnings
```
- `EXPLAIN (ANALYZE, BUFFERS)` 5 hot queries with `generate_series(100k)` seed: squad leaderboard page, squad feed p1, my-notes list, shared-with-me join, suggestion inbox. Assert Index Scan, no Seq Scan >10k rows.
- Egress: 50 concurrent `POST /api/sync/leetcode` — 60s cooldown holds (`429 + Retry-After`), no stampede.
- Realtime OFF for feed/notes (200-conn cap); 30s poll cheaper than 2M-msg burn.
- 12-check smoke (`scripts/smoke.mjs` in build): signup→profile, create squad→code, join via code, non-member empty, challenge→pending, duplicate→`duplicate`, complete-without-solve→`not_solved` / with→`completed`, private invisible→1:1 visible→squad visible→unshare revokes, feed <60s, global paginates with 0 membership, anon write denied everywhere.
- Migration: single idempotent `20261001_squad_notebooks_feed_v1.sql` — create tables → add `squad_id NULL` → backfill `General` → `SET NOT NULL` where required → constraints `NOT VALID` → `VALIDATE` → rebuild policies → `pg_notify('pgrst','reload schema')`.

---

## 10. Multi-squad, feed retention/JSON, big notes

**Founder prompts:** "mutli squad per user will be beneficial or one squad per user? feed retention maybe permanent, we will store them as json or something ig? idk abt notes, because notes can be really big in some cases and also some notes might include clickable links or code snippets as well" + "do your research on this for optimal way."

Researched verdicts (docs: Supabase RLS guides, multi-tenant playbooks, TOAST/FTS docs, pg_cron/archive patterns):

1. **Multi vs single: schema multi, UX single-active v1.** Multi is truly more useful (placement + college + internship groups differ) but full multi-UX = switcher everywhere + merged feeds + per-squad notifications (2-3x scope, RLS bug surface). So N-N `squad_members` (never re-migrate) but v1 UI views one `active_squad_id` at a time. Join many, view one. Zero re-migration later.
2. **Feed permanent? Tiered, not permanent-in-DB.** 1k×5 events/day = 1.8M rows/yr ≈ 300-400MB noise — dead in year one on 500MB. Don't store feed as single JSON blobs (breaks pagination/RLS/egress — fetch MBs to show 20 rows). Keep normalized + `metadata jsonb` (already have). `feed_events` 90d hot in DB via nightly `pg_cron 03:00 UTC` delete; monthly dump >90d → storage `archive/feed/YYYY-MM.jsonl.gz` (1GB holds years, lazy-load on deep link) + `cron_log` audit; `feed_posts` permanent (100x lower volume). Permanent *logically*, tiered *physically*.
3. **Big notes with links/code: DB markdown + quotas.** No new columns — `content_md` markdown covers `[links](url)` + fenced code; add `react-markdown` renderer in build. TOAST auto-moves >2kB out-of-line (main table stays ~25MB; medium 1-2kB inline is the 6x-slow trap — dodge by never `SELECT content_md` in lists, only on open; split to `note_bodies` only if still slow). Caps: 50k chars/note (`octet_length ≤ 51200`), 5MB/user quota trigger (code compresses ~3x). Split giant guides into foldered notes (small fetches, granular sharing/search). Search client-side v1 (<1k notes); `fts tsvector generated + GIN` at P2; Storage only if single notes regularly >100k (novel-size — not yours).

Locks asked: active-squad UX OK? 90d hot + JSONL cold OK? 50k/5MB OK?

---

## 11. Optimal free stack (open to anything, currently Supabase)

**Founder prompts:** "im open to using any other free technologies or hosting or db stuff like that. currently i have supabase" + "do your research on whats the optimal way to build a feed like ours, a squad system like ours, a notes sharing capability like ours."

Verdict after comparing Supabase vs Neon vs Turso vs Firebase vs PlanetScale (gone) vs Convex vs Appwrite vs Stream vs Upstash vs R2/D1: **stay Supabase-only, add 1 cheap sidecar later. Don't replatform.**

| Need | Winner free | Why |
|---|---|---|
| DB+Auth+Storage+Realtime | Supabase 500MB/50k MAU/1GB/2M msgs | Neon 0.5GB×100 no auth/storage/realtime (re-integrate 3); Turso 5GB no RLS/auth; Firebase 50k reads/day dies on polling + Storage removed Spark Feb 2026 + lock-in; PlanetScale free gone Apr 2024 (portability lesson: stay standard Postgres + `pg_dump`) |
| Feed | Supabase hot + Storage/R2 archive | Stream $499/mo cliff, 20 posts/req, separate tokens; Convex second DB + $25/dev; Firestore per-read billing; Upstash 500k cmds no RLS (cache only, not truth) |
| Squads | Supabase RLS | Clerk+Neon manual JWT bridging + 2 bills; Appwrite Teams 500k reads cap + weaker row-joins; Firebase denormalize `squadIds[]` pain |
| Notes | Postgres markdown + Tiptap read-only | Liveblocks 50-100 MAU + 3k collab-min + $30+$49 Cloud minimum — waste for async; Convex second perms; blobs unindexed (need sidecar row anyway); Typesense $21/mo / Meilisearch 14-day trial — pg FTS free forever wins |

Final $0 stack: Vercel (stay) + Supabase (DB/auth/RLS/hot feed/notes/FTS) + R2 later for cold archive (10GB free vs 1GB) + Upstash optional 30s feed/leaderboard cache to cut egress. All portable, one `squads` migration and done.

---

## 12. Existing solutions teardown — how well each does it

**Founder prompt:** "do comprehensive research mate on this. find existing solutions on this, and whether how well it is. we need a optimal solution/approach."

| Product | Loop | Squad model | Sync | Price | Scale | Verdict (3 lines) |
|---|---|---|---|---|---|---|
| YeetCode.xyz | Live duel, same problem+clock, XP/bounty/wager | Duel links, open matches, group/uni/global boards, guest via LC username | Public username only, never password | Free core forever, Plus $3.99/mo (AI, tags, freezes; first 500 `PAY404` lifetime) | Indie 2025-26, <1k | Best live bridge, zero-friction guest. No notes/feed, realtime-only (bad async schedules), longevity risk. Weekly showdowns, not home. |
| DSABuddy | 6-platform unified dashboard, heatmap, sheets auto-checkoff, PYQs | Campus boards (college/dept/cohort), 3000-pt normalized score. No private 3-10 rooms/feed | Public username only, no passwords | Free, no paid tier found. 40k Q-bank, 600+ cos | NSUT Jul 2026, 100s-low 1000s | Best placement tracker. Cohort-scale not private rooms; no challenges/notes/feed. Aggregator alongside, not replacement. |
| LeetLeague | Track→Analyze→Compete, topic analytics, roadmaps, bookmarks | Friends+compare, **Clans** (collective + boards) + **realtime clan chat** + global feed + boards | Likely public username aggregation | Free, no pricing page | Student Aug 2026, tens-hundreds | Closest feature-match (clans/chat/feed). Brand-new, unknown reliability, no pattern editor/challenge designer, bus-factor risk. Pilot only with backups. |
| Friends Leaderboard (+Leetboard/L'Amigo/Contest Tracker ext) | Add usernames → solves/rating/streak board | Private rooms (ivory app) / 50-friend lists / contest Friends tab / localStorage | Public username + Google OAuth; undocumented GraphQL | Free/OSS | 100s-1000s installs | Cheapest private-room fix. Leaderboard-only, no challenges/notes/feed, daily freshness, fragmented forks. Stopgap ranking while you build. |
| LeetGrind (+Discord fork) | Daily cron → weighted points → immutable snapshots → team board | Team 5+ board; Discord fork daily tags + Monday board + goals | Public username + Google OAuth, batch GraphQL 5-conc 1s delay, midnight UTC | Free OSS (self-host Vercel/Postgres/cron/Upstash) | ~100 explorers Feb 2026 | Cleanest self-host grind engine. Dev-ops burden, 24h stale, no notes/feed/challenges, breaks on rename. Fork only for data ownership. |
| NeetCode.io (+Versus) | Blind75/150/250 → video → solve → progress % | No squads. Solo + Pro Discord + Versus matchmaking + global boards | No LC sync, own judge/checklist | Free videos+lists; Pro $119/yr $297 life (struck $199/$599, auto-renew off) | ~700k YT, MMs visits; Versus tiny | Best curriculum authority (200+ videos, 8 langs, NeetBot). Solo-first, no private squads/notes/feed/challenges. Pattern source to link, not squad layer. |
| AlgoDrill | Pattern guide → fill-in-blank recall drill → missed-line + SRS | No social. Solo plan (date/days/budget) | No LC sync, own library + paste | Free 10 + 5 custom; Lifetime $19 launch ($99 reg), no sub | Dozens-hundreds Jun-Sep 2026 | Best for blanking (retype missing lines). Strictly solo, Python-first, small lib. Assign pre-interview; screenshots to feed at most. |
| SkillFlow | Skill 1-1000 ×10 topics → weakest-topic pick → 45-min sim + AI follow-ups | Explicit no community | No LC sync, own judge Py/Java/C++ | Free, no premium | Very early Jun 2026 | Best solo diagnostic. No squads/tags/community. Trainer to find what to bring to squad; can't host squad. |

Gap none cover: private 3-10 + async challenge + shared pattern notebooks + squad feed in one RLS-native app. That's the wedge (§3).

---

## 13. Realtime co-edit: rejected

**Founder prompt:** "i think real time co edit isnt necessary isnt it?"

Confirmed: **dropped.** Loop is async read+copy, not simultaneous typing. Yjs/Liveblocks = per-minute/MAU billing + 60s webhook throttle + second auth for a feature async college schedules never use together. Async read+copy + comments on note/challenge covers 80% at ~0 cost + manual version snapshot (owner-only restore, no CRDT). Tiptap read-only renderer stays; Liveblocks/Hocuspocus/Tiptap Cloud explicitly out of v1, additive later with zero re-migration.

---

## 14. Prompt-to-Decision traceability (no prompt missed)

| # | Founder prompt (spirit) | Decision location |
|---|---|---|
| 1 | Launch fun project free on LinkedIn | §1, §2 launch-blockers |
| 2 | Audit build + can it get users | §2 full audit |
| 3 | Won't people say clones exist, why yours | §3 wedge + §12 teardown |
| 4 | Shared/private notes, global board, challenge mate, enthusiast feed — thoughts? | §4, §5, §6, §7 initial verdicts |
| 5 | Share 1:1 AND squad; folders AND patterns; user posts optional + platform updates + contest cron | §4 both-scopes/both-org, §7 user/platform/contest |
| 6 | Squads = real groups not all-logged-in; separate tables; full schema change; polish rationally no slop | §8 primitive + this doc |
| 7 | Document ideation as plans/vision carefully | This file (was skeletal VISION.md, now exhaustive) |
| 8 | Optimal DB schema once-and-done + stress + smoke, Supabase free only, via npx supabase | §9 |
| 9 | Multi vs single squad; permanent feed as JSON?; big notes with links/code | §10 |
| 10 | Research optimal way (those three) | §10 researched verdicts |
| 11 | Open to any free tech; optimal feed/squad/notes stack | §11 |
| 12 | Comprehensive research on existing solutions + how well + optimal approach | §12 + §11 |
| 13 | Realtime co-edit unnecessary? | §13 rejected |
| 14 | What does a DSA learner actually need? | §15 |
| 15 | Roadmap/primer notes (ChatGPT Arrays+Hashing helped — that approach good?) | §16 pattern primers |
| 16 | Community where best share resources/tips via feed/notes + links/videos — get the idea? | §17 community |
| 17 | Do you know Threads/LinkedIn community, solutions sharing, how LinkedIn works? Don't be stupid | §18 mechanics |
| 18 | How platforms are made: LinkedIn post kinds (text+images/links/anything), followers/connections, same for Threads — research that | §18 specs |
| 19 | Those were for feed — DSA/dev social media, something innovative to get users. Understand? | §19 feed-as-social |
| 20 | Write it ALL in documentation, very detailed, miss nothing | This document |

---

## 15. Learner needs: what a DSA learner actually requires

**Founder prompt:** "lets say if someone is learning dsa what is required for them? can you think about it."

Stripped framework (maps to build in brackets):
1. **What to solve** — fixed roadmap ordered by pattern dependency (Blind75→150→Striver), not 3000 random. [Have: sheets — link, don't rebuild.]
2. **How to think** — 3-line intuition + template + complexity + when-NOT-to-use per pattern. [Wedge: notebooks — mate's words beat videos.]
3. **Where to struggle** — type + submit vs hidden tests + edge fails + 45-min no-hint timer. [Don't build judge — LeetCode owns it. You frame session: dock timer+scratchpad+AC detect.]
4. **When to revise** — attempted vs solved + mistake log (off-by-one/overflow/wrong-DS) + `Review due` by recency. [Missing — build dead-simple Revise view after notebooks; no SRS algo v1.]
5. **Why it works** — state O(time/space) + alternative unprompted. [Dock prompt `intuition, complexity, edges` required on share.]
6. **Who keeps you honest** — 3-10 who see slacking + async challenges + streak guardian + weekly contest ritual. [Core: guilt + feed proof.]
7. **Where you're weak** — per-pattern solved% (DP 20% vs Arrays 80%), not counts. [Cheap from status map + bento; no AI coach v1.]

Explicitly NOT v1: company tags, video courses, AI hints, global rank, live co-edit, judge.

Stack: curated list (have) → dock session (have) → pattern note (building) → challenge mate (have) → revise weak (missing) → contest together (cron planned).

Locks asked: beginner vs placement-ready? one language per squad? Revise view in v1 or after notebooks?

---

## 16. Pattern primers (the ChatGPT Arrays+Hashing insight)

**Founder prompt:** "if someone is learning they might need a roadmap or notes you know for learning data structures or approaches like sliding windows etc, for example one day to study chatgpt made me notes for arrays + hashing. and after going the notes it was honestly helpful for doing questions after reading them. so i think that approach is good isnt it."

Yes — and it's the missing middle layer. What helped you is a **primer** (before struggle: what/when/template/complexity/mistakes), not a solution note (after solving). App today jumps topic tile → problem list → dock with no learn step; Vault templates disconnected; planned notebooks were per-problem only.

Polished form:
- **Guide per topic:** `When to use (3 signals) → 1-language template → complexity → 3 classic mistakes → 3 starter problems linked`. 10-min skimmable, not textbook. Lives atop the topic tile: Guide on top, problems below, squad notes attached. Learn → attempt → share in one place.
- **Source v1 squad-curated, not AI-generated.** Paste your ChatGPT-style notes in; squad refines. Auto-generating all guides day one makes you generic content site vs NeetCode — lose. Squad's own words = moat. AI import (paste markdown → save) later.
- Same tables: `personal_notes kind: primer|approach` pinned to topic. No new table, no AI pipeline v1.

Three note kinds, distinct jobs: **Primer (before)** how pattern works — one per topic; **Attempt (during)** dock intuition — per solve private; **Approach (after)** cleaned solution — per problem shared.

Locks asked: one shared primer per pattern per squad vs each own? one template language (Python?) vs agnostic? seed with your Arrays+Hashing notes as first primer?

---

## 17. Community: best teach via feed/notes/links/videos

**Founder prompt:** "im thinking of making community people doing dsa, so that ppl who are best at dsa can share their resources or tips etc in there via feed or their notes. something like that. or do you remember i said they can also keep links so they can share videos as well if needed. so do you finally get the idea of what im thinking."

Yes — two rings, one system:

- **Inner: squad (learn together).** 3-10 mates, private default. Dock, challenges, notebooks, primers, squad feed. Consistency via guilt.
- **Outer: community (learn from best).** Anyone good publishes pattern primer / approach / template / link bundle (best videos/articles for X + one-line why each). Posted to global feed as public note, discoverable by topic, **copyable into your notebook in 1 tap**. Best rise by copies + completes, not likes.

Links/videos: no hosting courses — curate pointers. Public note = `title + markdown + pattern_tag + problem_slug? + link(s)`. Original writing OR "3 videos + my 5-line summary that made it click" — both valid.

Full loop: Best publishes + links → global feed → you copy to Notebook → attempt in dock → challenge mate → mate reads your copy → squad feed proof → best's original attributed (`forked from @best`).

Private↔public = one toggle, same table (`visibility private|squad|public`), same RLS. No separate community app, no moderation queue v1 (public = read+copy+comments only, no DMs/chat).

Locks asked: public posting open day one vs earned (10 solves)? copies keep `forked from` attribution? links-only allowed or require short note?

---

## 18. LinkedIn + Threads mechanics research

**Founder prompts:** "do you actually know how threads or linkedin community works? where people share solutions etc?" + "how their platforms are made, how posting is on linkedin in post what kind of posts they can do, text + images or text + links or anything. and there are followers connections etc and similar thing for threads."

### 18.1 LinkedIn post primitives (2026 specs)

| Format | Spec | Signal it earns | DSA use |
|---|---|---|---|
| Text | 3,000 chars, truncates ~210 (2-3 lines) behind see-more | Comments/conversation | Approach + complexity, hook first 2 lines |
| Text + single image | +1 static 1200×627 | Reach + context | Chart/screenshot/code visual |
| Multi-image (≤9) | Gallery | Showcase | Before/after code, event recap |
| Carousel = Document | PDF/PPT/DOC → swipeable in-feed, ≤300 pages (use 8-15), 1080×1080, ≤100MB | **Saves + dwell (highest)** | `P1 problem, P2-4 approach, P5 code, P6 complexity` |
| Native video | MP4 ≤5GB ≤10min (<90s best); YouTube/Vimeo links suppressed | Watch time / follows / profile visits | Template walkthrough, talking head |
| Poll | 2-4 options × 30 chars, 1d/3d/1wk/2wk | Vote volume (shallow) | `O(n) or O(n log n)?` → answer post after |
| Article | Practically unlimited (~100k), headers/images/embeds, profile Featured/Activity, Google-indexed | Longevity/SEO | Evergreen deep dive |
| Newsletter | Article series + subscribe; push + email + feed per edition; needs Creator Mode | Subscriber growth/retention | Weekly primer series (strongest distribution 2026) |
| Repost ± thoughts, Celebrate, Events, Live (Live needs Creator Mode) | — | — | Rituals, contest events, live solves |

External links in body = penalty; put in first comment or newsletter.

### 18.2 LinkedIn graph + distribution (2026 Interest Graph, 360Brew)

- **Connections:** mutual request+accept, cap **30,000**, auto-follow each other, free DM, 1st-degree (theirs = your 2nd-degree for intros). ~100 invites/week. Since Sep 2024 removing connection also unfollows both.
- **Followers:** one-way, uncapped. Posts only, no DM (InMail paid). Profile follower count includes connections. Creator Mode flips default Connect→Follow.
- **Feed now:** ~31% 1st-degree, ~25% 2nd/3rd relevant, ~10% Suggested strangers. Topic-embedding matched to past engagement, not just follows. Ranked signals: **dwell highest, saves + private shares high, thoughtful comments high, likes low, follower count low, external links negative, expertise-context (headline/history/consistency) high.** First 30-60min velocity decides expansion; replying to comments = distribution work. Newsletter = strongest channel (notification + feed). Reach:follower ratios 13-225x observed — followers inert without topical fit.

### 18.3 Threads primitives + graph

- Posts: text **500 chars** + images/video/carousel + polls + replies (real content) + **repost + quote** + custom feeds + Starter Packs + DMs + spoiler/bio links. One room = one thread.
- **For You = AI-ranked** (predicts reply/follow/profile-click/like/scroll-past + velocity; reply + follow-probability top, scroll-past negative throttle). **Following ≈ reverse-chron** newest first. Most users stay on For You. `Dear Algo` steers For You in plain language. First-30min test-group seeding decides kill/expand.
- **Fediverse (ActivityPub, opt-in 18+ public):** toggle → posts visible on Mastodon/Flipboard/WordPress; dedicated fediverse feed = pure reverse-chron unranked separate tab; search fediverse handles in-bar; 75%+ servers touched; no portability yet.

Lesson for us: steal primitives + follow/squad graph, reject black-box decay, vanity ranking, unstructured blobs, DM-support.

---

## 19. Feed as DSA social media: innovative growth design

**Founder prompt:** "i meant them for feed man. it is kind of social media for dsa/developers. something innovative so that we will get users. do you understand."

Yes — feed IS the product surface. Squads/notes/leaderboard feed in and out of it.

Post types (muscle memory, structured underneath):
- **Solve proof** (text+image): auto-verified `solved X in 24m` + dock timer + LeetCode badge. Completes > likes.
- **Primer** (carousel/article): signals → template → mistakes → 3 starters. Copyable.
- **Challenge** (quote): repost-any-problem `beat this` + deadline → 1-tap accept into dock.
- **Poll/MCQ sprint** (poll): concept check → answer thread reveals approach.
- **Link drop + why** (newsletter-ish): link MUST ship with 3-line takeaway or no post. Kills spam.
- **Streak/contest call** (celebrate/event): `14d flame`, `Contest in 24h — 5/8 in`.

Graph: Squads (mutual small capped = connections) → guilt, default feed. Follow-best (one-way uncapped = followers) → mentors, no DM baggage. Global topic (deterministic `pattern_tag + problem_slug` filter + chronological default) → discovery without black-box decay; March primer still finds May beginners. Copies/completes-ranked optional toggle.

Innovations LinkedIn/Threads can't copy:
1. **Copy-to-notebook 1 tap** — read → saved with problems attached → dock attempt. Save becomes practice.
2. **Proof over vanity** — rank by `copies + completes`, not likes. Best = most taught solves.
3. **Challenge-from-post** — every problem mention actionable, no retyping screenshots.

Tabs: `Squad (guilt) | Global (discovery) | Following (mentors)`. Squad default, global opt-in scope picker.

Locks asked: global posting open vs earned (10 solves)? default chronological+filter (fair) vs copies-ranked (rewards best)? anonymous doubts (more posts) vs real handle (more trust)?

---

## 20. Final data model, RLS, build order, non-goals, success checks

### 20.1 DDL sketch (single migration `20261001_squad_notebooks_feed_v1.sql`, idempotent)

```sql
-- Squads
create table public.squads (id uuid pk default gen_random_uuid(), name text not null check (char_length(name) between 3 and 50), invite_code text unique not null, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz default now());
create table public.squad_members (squad_id uuid references public.squads(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, role text check (role in ('admin','member')) default 'member', joined_at timestamptz default now(), primary key (squad_id, user_id));
create index squad_members_user_idx on public.squad_members (user_id);
-- Helper (plpgsql, NOT sql — avoids inlining/recursion)
create function public.is_squad_member(sid uuid) returns bool language plpgsql stable security definer set search_path=public as $$ begin return exists (select 1 from public.squad_members where squad_id=sid and user_id=(select auth.uid())); end; $$;
revoke all on function public.is_squad_member(uuid) from anon; grant execute on function public.is_squad_member(uuid) to authenticated;

-- Scope existing
alter table public.suggestions add column squad_id uuid references public.squads(id) on delete cascade;
alter table public.feed_events add column squad_id uuid references public.squads(id) on delete cascade;
create index suggestions_squad_created_idx on public.suggestions (squad_id, created_at desc);
create index feed_events_squad_created_idx on public.feed_events (squad_id, created_at desc);

-- Notebooks
create table public.note_folders (id uuid pk default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete cascade not null, squad_id uuid references public.squads(id) on delete set null, name text not null check (char_length(name) between 1 and 60), created_at timestamptz default now());
create table public.personal_notes (id uuid pk default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete cascade not null, squad_id uuid references public.squads(id) on delete set null, folder_id uuid references public.note_folders(id) on delete set null, kind text check (kind in ('primer','approach','note')) default 'note', title text not null check (char_length(title) between 1 and 120), content_md text not null check (octet_length(content_md) between 1 and 51200), pattern_tag text check (pattern_tag is null or char_length(pattern_tag) between 1 and 60), problem_slug text check (problem_slug is null or problem_slug ~ '^[a-z0-9-]{1,80}$'), visibility text check (visibility in ('private','squad','public')) default 'private', updated_at timestamptz default now(), created_at timestamptz default now());
create index personal_notes_owner_updated_idx on public.personal_notes (owner_id, updated_at desc);
create index personal_notes_squad_vis_idx on public.personal_notes (squad_id, visibility);
create table public.note_shares (note_id uuid references public.personal_notes(id) on delete cascade, shared_with_user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz default now(), primary key (note_id, shared_with_user_id));
create index note_shares_with_idx on public.note_shares (shared_with_user_id);

-- Feed posts + contests + comments
create table public.feed_posts (id uuid pk default gen_random_uuid(), author_id uuid references public.profiles(id) on delete set null, squad_id uuid references public.squads(id) on delete cascade, scope text check (scope in ('squad','global')) not null, body_md text not null check (octet_length(body_md) between 1 and 2000), link text, created_at timestamptz default now());
create index feed_posts_squad_created_idx on public.feed_posts (squad_id, created_at desc);
create table public.contests (id uuid pk default gen_random_uuid(), source text not null, title text not null, starts_at timestamptz not null, url text not null, created_at timestamptz default now());
create table public.suggestion_comments (id uuid pk default gen_random_uuid(), suggestion_id uuid references public.suggestions(id) on delete cascade not null, author_id uuid references public.profiles(id) on delete cascade not null, body_md text not null check (octet_length(body_md) between 1 and 2000), created_at timestamptz default now());
create table public.note_comments (id uuid pk default gen_random_uuid(), note_id uuid references public.personal_notes(id) on delete cascade not null, author_id uuid references public.profiles(id) on delete cascade not null, body_md text not null check (octet_length(body_md) between 1 and 2000), created_at timestamptz default now());

-- Quota guard (5MB/user notes)
create function public.enforce_notes_quota() returns trigger language plpgsql as $$ declare total bigint; begin select coalesce(sum(octet_length(content_md)),0) into total from public.personal_notes where owner_id = new.owner_id; if total > 5242880 then raise exception 'notes quota 5MB exceeded'; end if; return new; end; $$;
drop trigger if exists enforce_notes_quota on public.personal_notes;
create trigger enforce_notes_quota before insert or update of content_md on public.personal_notes for each row execute function public.enforce_notes_quota();
-- Backfill: General squad for existing rows; then SET NOT NULL where required (suggestions.squad_id); constraints NOT VALID → VALIDATE; rebuild policies (private owner-only / squad member read / public anon read); pg_notify('pgrst','reload schema').
```

FTS (`fts tsvector generated + GIN`) deferred to P2; client filter until 5k+ notes.

### 20.2 Build order

- **P0 Squads primitive:** squads + members + `/join/:code`, backfill General, scope suggestions + feed + leaderboard selector, fix `user_problem_status.notes` leak + double-fetch + `sw.js` scope + cooldown stamp + zoom block + CI.
- **P1 Notebooks + primers:** folders + notes + shares, Vault tabs `My Notebook | Shared With Me | Squad`, topic-tile Guide slot, share modal (squad toggle + friend picker), dock scratchpad → private note sync, `react-markdown` renderer, Revise view (attempted + due, recency only).
- **P2 Feed + contests + public:** `feed_posts` + auto writers, `/feed` Squad|Global|Following(+Platform), scope picker, comments, contest cron + cards, public `/n/:id` + LinkedIn share image, OG/sitemap/PostHog, push wiring, landing `/` + demo squad + OAuth.

### 20.3 Non-goals v1

Global chat/DMs, live duels/XP/wagers, judge, videos, company tags, co-edit notes, version history, embeds, public SEO at scale, Typesense/Meilisearch, Stream/Convex/Liveblocks Cloud, Firebase second auth.

### 20.4 Success checks

- Squad of 5 invites + challenges + shares end-to-end without touching global.
- Private notes never readable by non-owners (RLS negative tests pass).
- Squad feed shows solve/challenge/share <60s.
- Global works with 0 membership (empty state, not error).
- Copy-to-notebook → dock attempt → challenge → complete loop measurable via copies/completes.
- DB <400MB at 2k users; egress <5GB/mo (fix 20s poll first).
