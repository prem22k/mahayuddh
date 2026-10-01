# Mahayuddh — Execution Plan
## Derived from Product Operating System v2 (Source of Truth)

**Date:** 2026-09-30
**Source:** `Mahayuddh_Product_Operating_System_v2.md` (§0–§79)
**Goal:** Turn current DSA utilities into one behavioral system: **Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return**
**Strategy lock (§79):** Connect everything. Build the system, not the feature list.

### How to use this doc
- Each **Step** = one shippable increment, 2–5 days max. No mega-PRs.
- Each Step lists: **Goal / Bible refs / Current state / What to make (DB + API + UI) / Explicitly NOT building / Done criteria / Metric / Agent checklist**.
- Phases map 1:1 to Bible §71 Roadmap + §61 Classification + §62 Engineering Priorities.
- Filter for every step (§77): *Does this make it more likely a developer will practice, learn, challenge, teach, improve, or return?* If no → do not build.

### Current codebase inventory (verified 2026-09-30)
| Bible component (§5) | Status in repo | Reuse |
|---|---|---|
| Problem catalog (`problems` + `app/api/sync/catalog`) | Done partial — full LeetCode catalog sync exists | Reuse, harden |
| NeetCode/Blind75/Striver sheets (`custom_lists`, `list_problems`, `app/sheets/[slug]`) | Done | Reuse as curriculum source |
| Progress tracker (`user_problem_status`: solved/attempted, `lib/data/sheets.ts`) | Done basic, no history/timeline | Extend, don't replace |
| Now-Solving dock (`components/providers/SolvingProvider.tsx` — timer + localStorage only) | Done v0, no scratchpad persistence, no Attempt object, no stuck/fail paths | Upgrade to Dock v2 |
| Timer | Done (in-memory + localStorage) | Wire to proof |
| Scratchpad | Missing / ad-hoc | Build as Attempt |
| LeetCode sync (`app/api/sync/leetcode`, `leetcode-history`, `solved-slugs`, `lib/leetcode.ts`, `mark_solved_from_leetcode` RPC) | Done but fragile, session-cookie dependent | Decouple per §43 |
| Leaderboard (`app/leaderboard`) | Done basic (global, rating/streak) | Split squad/global per §33 |
| Challenge (`suggestions` table, `app/suggestions`) | Done basic async (pending/completed/dismissed) | Upgrade to Challenge v2 |
| Vault (`shared_resources`, `app/vault`) | Done basic (Template/Interview Log/Cheat Sheet/Article) | Split Vault vs Notebook per §16 |
| Squad | **Missing** — no `squads`/`squad_members` tables, home is global "Arena" | Build core in Phase 1 |
| Feed (`feed_events`: solved/streak/contest/suggested/completed) | Done v0, no squad scoping, no structured composer | Normalize + scope |
| Contest reminders (contest_rating in profiles) | Done partial display | Turn into ritual |
| Profile/dossier (`UserStatsDossierModal`, `app/api/auth/profile`) | Done partial | Evolve to journey |
| Share cards | Missing | Build in Phase 3 |
| Primers / Approaches / Notebook / Revision / Revenge / Chains / Beat-time / Stuck ladder / Goals / Seasons / Recaps / Following | All missing | Phased per below |

### Phase map
```
Phase 0 Trust (Steps 0-4)       → Bible §62, §43, §44, §54, §55, §52, §53
Phase 1 Core Battle Loop (5-11) → Bible §4.1, §6, §8, §9, §13, §26-28, §33, §48, §63
Phase 2 Learning Loop (12-15)   → Bible §14, §15, §16, §17, §23, §25, §47
Phase 3 Social Learning (16-20) → Bible §7, §9, §10, §11, §12, §29-32, §38-40
Phase 4 Community (21-23)       → Bible §18-22, §34-37, §46, §50, §51
Phase 5 Adaptive+Growth (24-26) → Bible §24, §45, §41, §42, §56, §57
Phase 6 Validation (27)         → Bible §58, §59, §76
```

### Global engineering rules (apply to every step, Bible §62 + §74)
1. No new table because a UI card exists. Battle Card = projection, not source of truth (§63).
2. Async by default. No realtime sockets, no live co-edit, no DMs, no global chat (§35, §61 KILL).
3. No realtime arch unless async demonstrably fails (§74 R6).
4. Deterministic before AI (§74 R7). No AI full-solution vending (§45).
5. Private first, explicit sharing (§Principle 6). Every public feature needs: privacy model + abuse note + empty state + error state + analytics event (§74 R9).
6. Every important action gets a next action (§Principle 9). Never strand user.
7. No game UI slop (§Principle 8). Restrained battle vocabulary.
8. Before implementation restate: problem / user / behavior / acceptance criteria (§74 R2). Reuse existing component (§74 R3).

---

## PHASE 0 — TRUST: Make it trustworthy before social

### Step 0 — Engineering hazard cleanup + CI gate
**Goal:** Eliminate known hazards so social features don't amplify bugs.
**Bible:** §62, §74
**Current:** No tests, no error boundaries, duplicate leaderboard fetch suspected, SW scope suspected, silent-empty helpers suspected, undocumented external endpoint dependence, zoom restriction.

**What to make:**
- **Audit + fix list (one PR per item, small):**
  1. `app/leaderboard/page.tsx` — dedupe fetch (single query, cache in `lib/data/profiles.ts`), add loading/error/empty states.
  2. `components/PwaRegister.tsx` + `public/sw.js` / `app/manifest.ts` — scope SW to `/` only, exclude `/api/*`, version cache, add offline fallback page.
  3. LeetCode sync cooldown — stamp `last_synced_at` + `sync_rate_limits` server-side only in `app/api/sync/leetcode/route.ts`; return `Retry-After`, never trust client timestamp.
  4. `lib/data/*.ts` — remove silent `return []` on error; throw typed errors, log to analytics, surface retry UI (pattern already in `app/page.tsx` `loadError` — replicate everywhere).
  5. Document every external endpoint in `lib/leetcode.ts` header: URL, auth, rate limit, fallback when down.
  6. `app/layout.tsx` viewport — remove `maximum-scale=1` / `user-scalable=no`; allow zoom for a11y.
- **Quality gates:**
  - `npm run lint` + `tsc --noEmit` in `.github/workflows/ci.yml` (block merge on fail).
  - Add `app/error.tsx` + `app/global-error.tsx` boundaries + per-route `error.tsx` for sheets/suggestions/vault/leaderboard.
  - Minimal smoke tests: `getCatalogCount`, `toStatusMap`, `parseProblemStatusEvent`, `mark_solved_from_leetcode` RPC contract (vitest or node:test — pick one, document in README).
- **NOT building:** new features, redesign, AI, gamification.
- **Done when:** CI green, all 6 hazards closed with before/after notes, error boundary manually verified by throwing in dev, zoom works on mobile.
- **Metric:** 0 silent-empty paths, build+lint pass rate 100%.

### Step 1 — Auth / RLS hardening + LeetCode decoupling
**Goal:** Own identity/squads/notes/challenges even if LeetCode breaks (§43).
**Bible:** §43, §44, §62
**Current:** `supabase/schema.sql` RLS is public-read + own-row-write, service-role bypass for sync; `leetcode_session_encrypted` column exists; sync depends on session cookie.

**What to make:**
- **DB:** migration verifying: `profiles` stats non-negative checks, handle length checks, `suggestions_pending_unique`, `lock_suggestion_parties` trigger — all already in schema; add missing `delete` policy on `suggestions` (currently update-only covers from/to; decide: only sender can delete pending, document).
- **API:** split sync into 3 explicit modes in `app/api/sync/`:
  - `leetcode/` (verified via session, rate-limited) → writes via `mark_solved_from_leetcode` only.
  - `solved-slugs/` (self-attested import) → never auto-promotes attempted (preserve trigger already does; add UI label "Self-reported").
  - `leetcode-history/` (read-only evidence link).
- **UI copy change everywhere:** replace "Verified solve" with honest states: `Attempted / Solved (self-reported) / Solved (LeetCode evidence) / Explained / Revisited / Challenge completed` (§44). Add tooltip explaining what verification means.
- **Remove:** any flow that *requires* pasting LeetCode session cookie to use app. Make it optional enhancement. Add warning banner + "Remove session" button.
- **NOT building:** own judge, scraping expansion, credential vault.
- **Done when:** new user can onboard, solve, challenge, share without ever connecting LeetCode; disconnecting LeetCode loses only evidence badge, nothing else.
- **Metric:** % of active users without LeetCode connected who still complete a battle (should be >0, not 0).

### Step 2 — Analytics + failure states + SEO/social metadata
**Goal:** Measure loops, not vanity (§57). Honest failure states (§73).
**Bible:** §57, §73, §74 R9
**Current:** No analytics lib, `console.error` only.

**What to make:**
- **Lib:** `lib/analytics.ts` — tiny event wrapper (posthog or supabase `analytics_events` table — pick one). Events (snake_case): `battle_started`, `battle_solved`, `battle_failed`, `approach_written`, `challenge_sent`, `challenge_accepted`, `challenge_completed`, `primer_read`, `note_copied`, `revisit_done`, `invite_opened`, `signup_from_challenge`.
- **Instrument:** SolvingProvider, sheets status toggle, suggestions send/accept, vault copy (later), onboarding steps.
- **SEO:** `app/layout.tsx` metadata (title/desc/OG/Twitter), `/opengraph-image`, `robots.ts`, `sitemap.ts` for sheets + public primers (later). Per-route titles.
- **Failure-state pattern:** every data surface gets `loading / error+retry / empty-teaches-next-action` (copy Step 0 pattern from Arena).
- **NOT building:** black-box feed ranking, complex dashboards. Internal query page is enough.
- **Done when:** activation funnel queryable: visit → first battle → first solve → first challenge sent/received.
- **Metric:** dashboard answers §76 review questions.

### Step 3 — Landing + onboarding + empty states
**Goal:** Cold start without requiring social graph (§41). First battle in <2 min.
**Bible:** §41, §42, §54, §55
**Current:** `app/page.tsx` is Arena dashboard, `app/login/page.tsx` exists, no dedicated landing, onboarding collects too much or nothing.

**What to make:**
- **Routes:**
  - `app/(marketing)/page.tsx` or `/welcome` (public): promise "Practice DSA with your people…", show Battle Card + squad recap + challenge chain visuals (static mocks ok), CTA: `Start solo` / `Explore demo squad`.
  - Onboarding modal/page (max 5 fields): account → display name → leetcode handle (optional, skippable) → objective (dropdown: Internship / Full-time / Consistency) → join/create squad OR continue solo → **Start first battle** button (no profile configuration wall).
- **Demo squad:** `seed_demo_squad.sql` — 5 fake members, leaderboard, 10 solves, 3 challenges, 2 primers, 1 season goal. Read-only, banner "Demo — join to interact".
- **Empty states (all teach + CTA):** No challenges → "Solve a battle and challenge a friend [Start a battle]"; No squad → "Create one and invite 2–7 friends"; No feed → "Start today's battle".
- **NOT building:** wizard with 10 steps, avatar upload, skill test.
- **Done when:** 5/5 hallway users reach first battle without help; Day-1 gate (§58) passes.
- **Metric:** first-battle-started rate, time-to-first-battle.

### Step 4 — Navigation IA + Home mental model skeleton
**Goal:** Nav maps to intent, not DB tables (§52). Home answers 5 questions instantly (§53).
**Bible:** §52, §53
**Current:** Routes: `/` (Arena), `/sheets`, `/suggestions`, `/vault`, `/leaderboard`, `/login`. No `/home`, `/practice`, `/squad`, `/feed`, `/notebook`, `/challenges`, `/profile`.

**What to make:**
- **Nav:** `components/layout/Sidebar.tsx` (or TopNav mobile): Home / Practice / Squad / Feed / Notebook / Challenges / Leaderboard / Profile. Keep old routes as redirects: `/` → `/home`, `/suggestions` → `/challenges`, `/vault` → `/notebook` (with tabs Vault/Notebook — full split in Step 13).
- **Home composition (skeleton, real data where exists, placeholders where not):**
  ```
  TODAY'S BATTLE [primary CTA — only one]
  YOUR SQUAD (goal/streak/member activity — empty state if solo)
  CHALLENGES (pending actions)
  YOUR PROGRESS (pattern weakness / recent improvement)
  FEED (recent high-signal activity)
  ```
- One primary CTA rule: dashboard shows exactly one dominant button (Today's Battle). Everything else is secondary link.
- **Mobile:** all sections stack, CTA sticky bottom, comfortable on phone (§73 Mobile).
- **NOT building:** new logic — this step is re-composition of existing queries + placeholders for future modules.
- **Done when:** user can answer §53 five questions in <10s hallway test.
- **Metric:** click-through on Today's Battle vs nav scatter.

---

## PHASE 1 — CORE BATTLE LOOP: Squad → Battle → Proof → Approach → Challenge → Activity

> If this loop is weak, more feed features will not save Mahayuddh (§4.1).

### Step 5 — Squads core (schema many-per-user, UX one-active)
**Goal:** Real small groups with identity, not "everyone logged in" (§26).
**Bible:** §26, §27, §28, §35, §66
**Current:** Missing entirely.

**What to make:**
- **DB migration `xxxx_squads_core.sql`:**
  ```sql
  squads (id, name, avatar_url, description, created_by, invite_code unique, shared_goal_text, season_name nullable, created_at)
  squad_members (squad_id, user_id, role: admin|member, active bool default true, joined_at, last_active_at, primary key (squad_id,user_id))
  profiles.active_squad_id nullable → squads.id (UX one-active, schema many)
  ```
  RLS: public read squads (for demo/invite preview); insert authenticated; update/delete admin-only; `squad_members` readable by members + public preview count; insert via invite code server function (prevent self-add abuse).
- **API:** `app/api/squads/` — `POST /` create, `POST /join {invite_code}`, `POST /switch {squad_id}`, `GET /mine`, `GET /[id]/preview` (for invite links).
- **UI:** `app/squad/page.tsx` — name/avatar/desc/members/admin/goal/season/streak/progress/activity/challenge-history (§27); create/join modal; invite link copy (`/squad/join/[code]`); member list with "nudge/challenge" shortcut; "Set active squad" switcher.
- **Goal v0 (§28):** `squad_goals (id, squad_id, title, target_count, pattern nullable, deadline, created_by)` + progress bar (total/completed/participants/days remaining). One active goal at a time.
- **NOT building:** multi-squad merged feed, rituals, seasons engine, wall, recaps (later steps).
- **Done when:** user can create squad, invite via link, join, set goal, switch active squad; solo user unaffected.
- **Metric:** squad creation rate, % users in ≥1 squad, members per squad (target 2–8).

### Step 6 — Today's Battle (Daily Battle entry point)
**Goal:** One obvious "what do I do now?" (§6). Single primary CTA.
**Bible:** §6, §24 (deterministic v0), §53
**Current:** POTD is `(date*13) % problems.length` — no personalization, no why, no squad context.

**What to make:**
- **Lib `lib/dailyBattle.ts`:** deterministic selector:
  1. inputs: user status map, squad recent activity, pattern exposure, last-battle time, active goal pattern.
  2. scoring: low recent exposure (+3), high failure rate (+2), long gap since revisit (+2), squad attempted but user hasn't (+2), goal pattern (+2), already solved today (−10).
  3. output: `{ problem_slug, title, difficulty, pattern, why: string[], squad_context: "4/7 attempted", personal_best: "31:22" | null }`.
- **UI `components/battle/TodaysBattle.tsx` on Home:** problem + difficulty + pattern + Why + Squad + Personal + single `START BATTLE` button. After solve: "Solved in 24:17" + next actions (Explain / Challenge / Revisit / Share) — each wired, none dead.
- **DB:** `daily_battles (user_id, date, problem_slug, reason_json)` cache (one row/day/user) to keep stable across refreshes.
- **NOT building:** AI recommender, SRS, multi-option list. One battle, one CTA.
- **Done when:** every user sees a different, explainable battle; why-text is truthful (no hallucinated stats).
- **Metric:** Today's-Battle start rate, solve rate.

### Step 7 — Now-Solving Dock v2 (practice engine + Attempt object)
**Goal:** Real solving session: think + code + scratchpad, honest solve/fail, stuck entry (§4.1, §12, §15).
**Bible:** §4.1, §12, §15, §44
**Current:** `SolvingProvider` timer only, localStorage, no persistence, no fail path.

**What to make:**
- **DB `battles` (sessions):** `(id, user_id, problem_slug, squad_id nullable, started_at, ended_at nullable, duration_sec nullable, outcome: in_progress|solved|failed|abandoned, self_reported bool default true, evidence: leetcode|none, scratchpad_md text, confidence 1-5 nullable)`. RLS own-row. One in-progress per user enforced via partial unique index.
- **Dock UI upgrade (`components/dock/SolvingDock.tsx`):**
  - Timer (keep, add pause/resume, persist to `battles` every 15s + localStorage fallback).
  - Scratchpad (Markdown, autosave to `battles.scratchpad_md`, private by default, char cap 20k).
  - Problem link-out (LeetCode open), pattern primer link (if exists).
  - End states: `Mark solved` (→ proof step) / `Mark failed` (→ revenge scheduled) / `Abandon` (confirm). Each requires explicit click — no auto-solve.
  - `I'M STUCK` button (entry to Step 18 ladder — v0 just logs `stuck_event` + shows Nudge options placeholder).
- **API:** `app/api/battles/` — start/end/update. Validate slug format `^[a-z0-9-]{1,80}$`.
- **NOT building:** code editor, judge, AI hints (Step 25), realtime presence.
- **Done when:** session survives refresh, timer honest, fail path creates Review-due item, scratchpad private.
- **Metric:** battle completion rate (solved+failed / started), median duration.

### Step 8 — Proof + Problem History timeline
**Goal:** Solved ≠ end. Solved → history object (§48). Honest trust model (§44).
**Bible:** §44, §48, §49
**Current:** `user_problem_status` single row per user/slug (solved/attempted + notes + solved_at) — no history.

**What to make:**
- **DB:** keep `user_problem_status` as *current state*; add `problem_events (id, user_id, problem_slug, kind: attempted|solved|explained|revisited|challenge_completed|failed|stuck, battle_id nullable, duration_sec nullable, metadata jsonb, created_at)`. Append-only (no update/delete by client, RLS insert own + public read). Backfill from existing rows via migration.
- **UI:**
  - Problem page (`app/practice/[slug]/page.tsx` — new): timeline (Feb 02 Attempted → Solved 14:23 → Mar 04 Revisited 11:52 → Explained → Challenged Rahul → Rahul completed → Apr 01 Revisited 08:51), each with duration/confidence.
  - Sheets matrix checkbox becomes timeline preview on hover/click (don't break matrix perf — list views fetch without bodies per §65).
- **LeetCode evidence:** if `mark_solved_from_leetcode` promoted row, badge "LeetCode evidence"; else "Self-reported". Never claim learning proof.
- **NOT building:** anti-AI police, score.
- **Done when:** every solve/fail/revisit appends event; timeline renders for 2+ event problems.
- **Metric:** % solves with ≥2 events (revisit/explain/challenge), timeline views.

### Step 9 — Approach capture (Approach = after, Primer = before, Attempt = during)
**Goal:** Thinking becomes shareable artifact, cleanly distinguished (§13, §15).
**Bible:** §13, §15, §47
**Current:** `user_problem_status.notes` freeform private; `shared_resources` generic.

**What to make:**
- **DB `approaches (id, user_id, problem_slug, pattern nullable, core_idea text, complexity_time/text, complexity_space, key_detail, edge_cases, mistakes, code text nullable, related_slugs text[], visibility: private|squad|public default private, fork_of nullable → approaches.id, created_at, updated_at)`.** RLS: private own-only; squad visible to squad_members; public readable. Cap code 20k.
- **UI:** post-solve prompt "Explain your approach" (from Step 6 next-actions) → form (core idea required, rest optional) → save private by default → explicit Share control (Private/Squad/Public + 1:1 user picker later in Step 13). Approach view page with Copy-to-Notebook button.
- **Distinction enforcement:** Primer label "Before — teaches pattern", Attempt label "During — private scratchpad", Approach label "After — what worked". Three tabs on problem page, never merged.
- **NOT building:** comparison view (Step 19), public discovery (Phase 4), AI feedback (Step 25).
- **Done when:** solve → approach write rate measurable; approaches private by default, sharing intentional + reversible.
- **Metric:** approaches per solve, % shared to squad/public.

### Step 10 — Challenge System v2 + Beat My Time + deep links
**Goal:** `I solved X → I challenge you to solve X` stays async, gains time-target + pass-along (§8, §9, §10, §42).
**Bible:** §8, §9, §10, §42
**Current:** `suggestions` has from/to/slug/title/difficulty/note/status — no time, no deadline, no chain, no deep link.

**What to make:**
- **DB migration:** `suggestions` += `sender_time_sec nullable, beat_time bool default false, deadline_at nullable, parent_id nullable → suggestions.id (chain link), message text (rename note usage), spoiler bool default false`. Keep parties/problem immutable trigger; extend to time fields immutable after send (except status).
- **API + UI `app/challenges/page.tsx` (rename from suggestions):**
  - Send flow: from Battle Card / Approach / Problem page → picker (squad member / username) → optional "beat my 21:43" toggle (prefills from latest battle) → optional deadline + message → no spoiler by default.
  - Inbox card: "Rahul challenged you — LRU Cache Medium — Rahul solved in 21:43 'Try to beat this' [ACCEPT] [Decline]". Accept → starts battle with `challenge_id` attached. Complete → auto-marks `completed_at` + appends `problem_events` + notifies sender.
  - Actions: Accept / Decline / Remind (rate-limited 1/24h) / Complete (auto) / Pass (forward to another user, sets parent_id → chain).
- **Deep link:** `/c/[id]` public preview (problem + target time + message, no spoiler) → Accept → minimal signup (no wizard) → lands directly in battle (§42).
- **NOT building:** betting/wagers (§10 ban), realtime battle, global chat.
- **Done when:** full loop works via link for logged-out user; chain of 3+ passes renders.
- **Metric:** challenge send rate, response rate, completion rate, chain length (Loop A §56).

### Step 11 — Squad Activity Feed v1 + Squad Leaderboard v2
**Goal:** Feed = activity generated by learning, not LinkedIn (§18). Leaderboard = accountability with people you know (§33).
**Bible:** §18, §19, §33, §50, §64
**Current:** `feed_events` global, types solved/streak/contest/suggested/completed; leaderboard global only.

**What to make:**
- **DB:** `feed_events` += `squad_id nullable, object_type/text, object_id/text, event_type` extend to `solve|teach|challenge|complete|improve|stuck|resource|contest|squad_milestone`. Add `squad_id` index. Retention: hot 90 days, archive job placeholder (don't retain noise forever §64).
- **Feed UI `app/feed/page.tsx` with tabs Squad (default) / Following (placeholder) / Global / Platform:** structured cards (Solve: "Prem solved 3Sum in 26m [View approach] [Challenge]"; Improve: "31m→19m"; Stuck: anonymous option). No blank "What's on your mind?" as primary — composer is structured: Share solve / Teach / Challenge / Ask help / Share resource / Discuss (§18 Composer).
- **Leaderboard split:** `app/leaderboard/page.tsx` → tabs Squad (primary, active-squad scoped: solved/rating/streak/challenge participation/recent) + Global (secondary, paginated, separate route, de-emphasized in onboarding). No single giant score as only metric.
- **Anti-ghost:** new squad of 5 auto-generates activity from solves/challenges/goals/contests — no prose required (§50).
- **NOT building:** ranking algorithm, likes-as-competence, Following/Global ranking depth (Phase 4), moderation platform (report/block/delete/rate-limit only).
- **Done when:** squad with 5 users shows useful feed without anyone writing a post; squad tab is default.
- **Metric:** feed actions per solve, squad weekly actives.

---

## PHASE 2 — LEARNING LOOP: Primer → Notebook → Copy → Solve → Improve → Share

> Important action is turning content into practice, not saving content (§4.3).

### Step 12 — Primers v1 (learn before battle)
**Goal:** Skimmable 5–10 min pattern intro, immediately usable (§14).
**Bible:** §14, §15, §17
**Current:** None. Vault has generic articles, no pattern template.

**What to make:**
- **DB `primers (id, slug unique, pattern, title, recognize_when text[], mental_model text, template_md text, complexity text, mistakes text[], starter_slugs text[3], author_id, visibility: squad|public default squad, fork_count int default 0, created_at)`.** Seed 5 primers: Sliding Window, Two Pointers, Stack, Graphs (BFS), DP (1D).
- **UI `app/primers/[slug]/page.tsx`:** Pattern / Recognize it when (3 bullets) / Mental model (ascii) / Template (language-agnostic + optional code) / Complexity / Mistakes (3–5) / Starter problems (3 linked) / `START PROBLEMS` CTA → starts battle on first starter.
- **Wiring:** problem page shows linked primer; Today's Battle "why" links primer; primer read logs `primer_read` analytics.
- **NOT building:** textbook chapters, video library, AI-generated 100 primers.
- **Done when:** 5 primers shippable, each readable in <10 min hallway test, each drives ≥1 battle start.
- **Metric:** primer → battle start rate, primer copies.

### Step 13 — Notebook vs Vault split + sharing + fork
**Goal:** Vault = shared reusable; Notebook = personal; Copy preserves attribution (§16, §47).
**Bible:** §16, §47, §65
**Current:** `shared_resources` only, all public-read, no visibility levels, no fork.

**What to make:**
- **DB:**
  - Keep `shared_resources` as **Vault** (shared). Add `visibility: squad|public`, `squad_id nullable`, `fork_of nullable`, `fork_count`.
  - New `notebook_notes (id, owner_id, folder nullable, pattern_tags text[], problem_slug nullable, title, body_md text, visibility: private|squad|public default private, squad_id nullable, fork_of nullable, created_at, updated_at)`. Markdown sufficient (§65). List views exclude `body_md`.
- **UI `app/notebook/page.tsx`:** tabs My Notes / Vault / Shared with me. Folders + pattern tags + problem links. Share control: Private / Squad (picker) / Public + 1:1 user share (`note_shares (note_id, shared_with, can_edit bool)`). Core button everywhere: `COPY TO MY NOTEBOOK` → private editable copy with "Forked from @prem" banner.
- **RLS:** private own-only; squad visible to members; public readable; 1:1 via shares table.
- **NOT building:** Notion clone features (databases, realtime collab), full-text search (only when usage justifies §65).
- **Done when:** user can write private note → share to squad → stranger copies with attribution → original author sees fork count.
- **Metric:** copies per public note, note → practice rate.

### Step 14 — Revision (Review Due) + Pattern progress
**Goal:** Simple revisit system + actionable pattern estimate, no fake mastery math (§25, §23).
**Bible:** §23, §25
**Current:** No revision; progress = counts only.

**What to make:**
- **Lib `lib/revision.ts`:** `isReviewDue(user, problem)` = failed attempt OR gap > N days (N=14 default) OR weak pattern (failure rate >40%) OR manual bookmark OR confidence ≤2. No SRS algorithm yet (§25 ban on complex SRS).
- **UI `app/practice/page.tsx` (new Practice hub):** sections `Review due (N)` / `Weak patterns` / `Continue` / `New`. Each card: last result, gap, `START REVISION` CTA. Bookmark toggle on problem page.
- **Pattern panel:** per pattern Exposure / Solved / Recent failures / Revisits / Novel solves → status `Strong / Developing / Weak` (label "estimate, not proof" §23).
- **DB:** `review_queue (user_id, problem_slug, reason: failed|gap|weak_pattern|bookmark|low_confidence, due_at, done_at nullable)` materialized on battle end via trigger/function, cleared on solve.
- **NOT building:** adaptive SRS, mastery score, single skill score (§22 ban).
- **Done when:** failed problem reappears in Review Due within 24h; solving it clears entry + logs revisit event.
- **Metric:** revisit rate, revenge-adjacent solve rate, weak→developing transitions.

### Step 15 — Knowledge graph wiring (Pattern + Problem hubs)
**Goal:** Pattern and Problem become connected hubs, not isolated pages (§17).
**Bible:** §17, §63
**Current:** Sheets list + catalog topics exist but unlinked.

**What to make:**
- **Pattern page `app/patterns/[topic]/page.tsx`:**
  ```
  Sliding Window
  ├── Primer (+ community versions)
  ├── Starter Problems (3)
  ├── Community Approaches (top by copies/completions)
  ├── Common Mistakes (aggregated from approaches.mistakes)
  ├── Recommended Videos/Articles (vault filtered)
  ├── Questions (stuck requests for this pattern)
  └── People who teach it (by forks/completions, not followers)
  ```
- **Problem page enrichment (extends Step 8):** Pattern / Attempts (own) / Approaches (squad+public) / Challenges / Squad activity / Discussion (placeholder) / Revisions.
- **Implementation:** all aggregations are queries over existing tables (no new source of truth). Add `problems.topics` GIN index already exists — use it.
- **NOT building:** separate CMS, new graph DB.
- **Done when:** every problem with ≥1 approach/primer shows connected hub; pattern page drives battle starts.
- **Metric:** hub → battle rate, approach copies from hub.

---

## PHASE 3 — SOCIAL LEARNING: Cards, Time, Revenge, Stuck, Compare, Goals, Rituals

### Step 16 — Battle Cards (canonical artifact, projection not table)
**Goal:** One solve → personal + social + shareable + historical object (§7, §38).
**Bible:** §7, §38, §39, §48
**Current:** Missing. Dossier modal exists but not shareable.

**What to make:**
- **Lib `lib/battleCard.ts`:** `getBattleCard(battle_id)` projects from `battles` + `problem_events` + `approaches` + squad completions → `{ title, difficulty, pattern, solved_sec, previous_best, attempts, revisits, challenges, friends_completed, approach_excerpt }`. No new table (§63).
- **UI `components/battle/BattleCard.tsx`:** ⚔️ TWO SUM Easy·Arrays/Hashing, Solved 14:23, Previous best 19:41, Pattern, Attempts 2, Revisits 1, Challenges 3, Friends 2, My approach excerpt. Actions: Challenge someone / Share / Revisit / Add approach / Compare squad approaches — every button wired (§Principle 9).
- **Share:** `app/b/[battle_id]/page.tsx` public preview (OG image via `app/b/[id]/opengraph-image.tsx`) → links back to problem/public note/squad/landing (§38). Copy-link + LinkedIn + WhatsApp share buttons.
- **Feed:** card creation emits `solve` feed event automatically.
- **NOT building:** XP/badges/casino animation (§Principle 8).
- **Done when:** solve generates card in <1s, share link opens for logged-out user with context + CTA.
- **Metric:** cards shared per solve, link → signup rate (Loop B §56).

### Step 17 — Revenge + Challenge Chains
**Goal:** Failed problems get emotional return reason; completed challenges continue as ritual (§11, §10).
**Bible:** §10, §11
**Current:** Failed outcome exists after Step 7 but no Revenge surface; chains missing.

**What to make:**
- **Revenge:** `review_queue reason=failed` surfaces as `REVENGE AVAILABLE — Trapping Rain Water — Previous 41:06 Failed — 19 days ago [TAKE REVENGE]`; success → `REVENGE COMPLETE Previous Failed 41:06 → Solved 28:11` card + feed event. One query over battles/events, no new table.
- **Chains UI:** challenge detail shows `Prem → Rahul → Arjun → Sandeep` chain (from `suggestions.parent_id`), states active/completed/broken/timed-out. `Pass the challenge` button. Squad view highlights longest active chain ("Challenge Chain — LRU Cache").
- **NOT building:** betting/wagers (explicit ban §10).
- **Done when:** fail → revenge → complete loop emits correct cards; 3-hop chain renders.
- **Metric:** revenge attempt rate, revenge success rate, avg chain length.

### Step 18 — I'm Stuck ladder (first-class dock action, no-spoiler culture)
**Goal:** Least help to continue thinking, not fastest answer (§12).
**Bible:** §12, §45 (AI later)
**Current:** Button placeholder from Step 7.

**What to make:**
- **UI in dock:** `I'M STUCK` → choose: Nudge (small clue) / Pattern hint / Direction / Full explanation (accept spoiler). Each choice creates `stuck_requests (id, user_id, problem_slug, battle_id, level, visibility: squad|public|anon default squad, status: open|helped|resolved, created_at)` + feed `stuck` event (anon option).
- **Response UI:** squad members see request (no solution by default) → reply at same level (`stuck_replies (id, request_id, author_id, level, body_md, accepted bool)`). "Think about what remains monotonic…" favored over code dump — enforce via placeholder copy + spoiler gate (Full requires explicit expand).
- **Rate limits:** 3 open requests/user, 1 reminder/24h. Reporting/block/delete-own.
- **NOT building:** AI hints yet (Step 25), instant solutions as primary action.
- **Done when:** stuck → nudge → continue → solve path works without revealing full solution.
- **Metric:** stuck resolution rate, % resolved at Nudge/Pattern level (higher = better).

### Step 19 — Approach comparison + Squad goals engine + Seasons scaffold
**Goal:** Learn how friends think; give squads shared intent containers (§27–§30).
**Bible:** §28, §29, §30 (plus §13 comparison implied)
**Current:** Goals v0 single-goal from Step 5; no comparison, no seasons.

**What to make:**
- **Comparison `app/practice/[slug]/compare/page.tsx`:** side-by-side squad approaches (core idea + complexity + key detail, code collapsed by default, no-spoiler blur until explicit reveal). Highlight pattern differences, not "winner".
- **Goals upgrade:** multiple goals/squad, progress auto from `problem_events` (pattern-filtered counts), reminders ("3 solves away from weekly goal") — wire to notifications in Step 23.
- **Seasons scaffold:** `squad_seasons (id, squad_id, name e.g. "Season 01 — Graph War", objective, start_at, end_at, metrics_json, status)` + season view (problems/challenges/approaches/active members) + `Season Complete` state → prompts new season. Keep metrics manual-count queries, no gamified shop.
- **Rituals config (no automation yet):** squad settings checklist Mon Pattern / Tue Battle / Wed Challenge / Thu Teach / Sat Contest / Sun Recap — each links to existing surface. Automation comes after validation.
- **NOT building:** over-gamification, XP economy, betting.
- **Done when:** squad can run a 1-week season with goal + comparison + manual recap link.
- **Metric:** approaches compared per solve, goal completion rate.

### Step 20 — Recaps + Squad Wall + Shareable artifacts + Distribution plug-in
**Goal:** History feels cumulative; artifacts drive LinkedIn/WhatsApp growth (§31, §32, §38, §39, §40).
**Bible:** §31, §32, §38, §39, §40, §56 Loops B/D
**Current:** None.

**What to make:**
- **Recap generator `lib/recap.ts`:** weekly query (solves/challenges/approaches/patterns/biggest improvement/most challenged/most copied primer) → `squad_recaps (id, squad_id, week_start, body_json, created_at)` + UI `app/squad/[id]/recaps/page.tsx` + OG image share card.
- **Wall `app/squad/[id]/wall/page.tsx`:** visual milestone timeline (First member → First challenge → 50 solves → First Graph Battle → 100 solves → Season complete). Store milestones in `squad_milestones (id, squad_id, kind, title, occurred_at)` appended by triggers on events; cap hot list, archive old.
- **Share cards:** Battle Card (Step 16) + Squad Recap + Season Result + Personal Journey (30-day: battles/solved/patterns/approaches/challenges/revenge/squad battles — projection over events) + Primer. Each with OG image + deep link back (§38).
- **Distribution:** WhatsApp/Discord message templates with `[Accept Challenge]` / `[View recap]` links (§40). LinkedIn post template showing product (battle card visual), not abstract announcement (§39).
- **NOT building:** auto-posting to LinkedIn, paid growth.
- **Done when:** squad of 5 generates first auto-recap; share link drives ≥1 external visit in test.
- **Metric:** shares per recap, external visits per share, Loop B conversion.

---

## PHASE 4 — COMMUNITY: Public notes, Following, Teachers, Discovery

> Reward usefulness, not posting frequency (§4.4). Don't launch empty global feed pretending success (§19).

### Step 21 — Feed surfaces + structured composer + anti-ghost/anti-noise
**Goal:** Squad default, Following for learning, Global for discovery, Platform for announcements (§19, §20).
**Bible:** §18, §19, §20, §50, §51
**Current:** Single global feed v0 from Step 11.

**What to make:**
- **Tabs + ranking v0:** Squad (default, chronological + goal/challenge boost) / Following / Global / Platform (contests/product/maintenance only, admin-write). Ranking signals: copies, completions, revisits, challenge completions, discussion depth, pattern relevance, recency — likes excluded from competence (§20). Implement as SQL order expression, no ML.
- **Composer (structured, not blank box):** Share solve (picks battle) / Teach (links approach/primer) / Challenge (picks user+problem) / Ask help (stuck level) / Share resource (vault link) / Discuss (problem-linked, rate-limited). Each creates correct underlying object + feed event (feed never stores blobs §64).
- **Anti-noise (§51):** problem-linked + pattern-linked + actionable required for Global; report/block/delete-own/rate-limits/public-posting constraints (min 3 solves to post globally — tunable). No giant moderation platform yet.
- **NOT building:** black-box ranking, DMs, global chat.
- **Done when:** Global tab with 5 users doesn't look dead (shows platform + discovery picks) and doesn't look spammy.
- **Metric:** useful-action rate per feed view (copy/start/challenge/complete), report rate.

### Step 22 — Following / Mentor layer + Reputation (no single score)
**Goal:** "Useful to learn from" > "most followers" (§21, §22, §46).
**Bible:** §21, §22, §46
**Current:** None.

**What to make:**
- **DB:** `follows (follower_id, followed_id, created_at, pk)` + `teacher_stats` materialized view (verified solves, approaches, primers, forks, challenge completions, frequent patterns, improvement history). No single skill score (§22 ban) — show dimensions: Problem solving / Teaching / Helpfulness / Consistency / Impact.
- **UI:** profile `app/u/[username]/page.tsx` — journey header (Step 8 timeline summary) + dimensions + "Often teaches: Graphs·DP·Sliding Window" + Follow button + their public approaches/primers. Following feed tab wires here.
- **Teacher discovery:** pattern pages (Step 15) "People who teach it" sorted by forks/completions, not followers.
- **NOT building:** creator program, monetization, vanity badges.
- **Done when:** user can follow teacher, see their approaches in Following feed, unfollow cleanly.
- **Metric:** follows per approach-copy, teacher retention (do useful authors publish again? Loop C §56).

### Step 23 — Notifications + Contests ritual + Leaderboard anti-problem views
**Goal:** Action-oriented, low-noise; weekly return reason (§37, §36, §34).
**Bible:** §36, §37, §34
**Current:** Push subscriptions table exists, no event wiring.

**What to make:**
- **Notifications `notifications (id, user_id, kind: challenge|goal|revenge|completed|recap|contest, title, body, deep_link, read_at nullable, created_at)`:** triggers on challenge received, challenge completed, goal near-complete, revenge available, recap ready, contest in 24h. Default low-noise (batch goal nudges max 1/day, quiet hours). Push via existing `push_subscriptions` + `lib/push.ts`; in-app bell with deep links.
- **Contests:** `contests (id, title, starts_at, url, created_at)` + ingest script (manual LeetCode contest calendar entry v0, no scraping) → feed Platform event + squad reminder + optional push. Purpose is ritual, not contest platform (§36).
- **Leaderboard views:** Squad stays primary; Global gains segments: Most improved / Rising / Pattern-specific / Recent activity + pagination. Beginner never lands on immortal 2000-solve ranking (§34).
- **NOT building:** like-notifications, generic digests, 14-notification spam.
- **Done when:** challenge → push → accept path works on phone; contest reminder fires 24h before.
- **Metric:** notification CTR by kind, contest-week return rate.

---

## PHASE 5 — ADAPTIVE INTELLIGENCE + GROWTH LOOPS

> Deterministic first. AI only where it increases thinking (§45, §74 R7).

### Step 24 — Personal Recommendation Engine (deterministic v1)
**Goal:** "Next battle" with truthful why (§24).
**Bible:** §24
**Current:** Step 6 daily battle heuristic — promote to full engine.

**What to make:**
- **Lib `lib/recommend.ts`:** signals low exposure / high failure / long gap / prerequisites / plateau / squad activity / goal. Output `Next battle: Number of Islands — Why: Graph low, 12 days gap, prerequisite done`. Expose on Practice hub + Home + Problem page "What next?".
- **Prereq map:** static `lib/patternPrereqs.ts` (e.g., DP needs Arrays+Recursion exposure) — hand-authored, no ML.
- **Logging:** store recommendation + accepted/rejected to validate signal weights before any AI.
- **NOT building:** ML model, black-box score.
- **Done when:** 4/5 recommendations have ≥2 truthful why-bullets; accept rate logged.
- **Metric:** recommendation accept rate, weak-pattern solve rate lift.

### Step 25 — AI where it strengthens learning (gated experiment)
**Goal:** Use AI to increase thinking, not eliminate it (§45).
**Bible:** §45, §12
**Current:** None.

**What to make (each behind `ai_enabled` squad flag, rate-limited, logged):**
1. Stuck assistant — same ladder as Step 18 (Nudge→Pattern→Direction→Full), never jumps to full.
2. Explain my mistake — analyzes failed battle scratchpad, points at concept, no full rewrite.
3. Practice next — NL wrapper over Step 24 engine (must cite why-bullets).
4. Explain-back — asks user to explain, gives feedback on approach draft.
5. Interview sim — follow-up questions on approach.
- **Guardrails:** no auto-posting, no mass primer generation, no replacing community explanations, spoiler gates, cost caps, abuse logging.
- **NOT building:** AI solution vending as primary action, filler posts.
- **Done when:** stuck-at-Nudge resolution rate with AI ≥ human baseline without increasing full-solution reveals.
- **Metric:** thinking preserved (level distribution), solve-with-understanding (revisit success).

### Step 26 — Growth loops instrumentation + cold-start polish
**Goal:** Challenge loop (strongest) + Share + Knowledge + Squad loops fire organically (§56).
**Bible:** §56, §41, §42, §40, §39
**Current:** Pieces exist, loops unmeasured.

**What to make:**
- **Loop A Challenge:** deep-link open tracking (`invite_opened`), signup friction audit (logged-out preview → 1-click signup → direct to battle, no wizard §42).
- **Loop B Share:** OG images for all artifacts (Step 20), `share_clicked` + `share_signup` attribution (query param `?via=battle_xxx`).
- **Loop C Knowledge:** fork attribution chain UI, creator `forks` + `completions` counters, "Your primer helped 12 developers solve X" nudge to publish more.
- **Loop D Squad:** invite existing WhatsApp/Discord groups via message templates (§40); squad creation from referral tracking.
- **Demo + landing polish:** demo squad realistic, empty global feed never pretends success.
- **NOT building:** paid ads, referral bribes, casino invites.
- **Done when:** full Loop A traceable in analytics: solve → challenge → link open → join → solve → new challenge.
- **Metric:** invites/active user, challenge-driven signups, share-driven signups, squad-from-referral rate (§57 Growth).

---

## PHASE 6 — VALIDATION: Prove squads repeatedly practice

### Step 27 — Two-week real-user test + gates + review cadence
**Goal:** Answer §76 review + §58 gates with behavior, not opinions.
**Bible:** §58, §59, §76, §60
**Current:** No test protocol.

**What to make:**
- **Recruit:** 3–5 real squads (college friends / clubs / Discord, 3–7 members each). No mass marketing.
- **Observe:** Day 1 understand? Day 3 natural challenge? Day 7 voluntary return? Day 14 meaningful history? Log hesitations, ignored features, outside-app workarounds, unprompted invites, "This is where we do DSA" quotes.
- **Gates (§58):** activation (first battle fast) / social (unchallenged challenges sent) / learning (reads/copies/approaches) / retention (week-2 active) / organic (unprompted invite) / qualitative.
- **Review doc:** weekly one-pager answering: practicing more? interacting? learning from each other? returning? joining via users? generating knowledge? If no → stop adding surface (§76).
- **Feature triage (§60):** label every request CORE/SUPPORT/EXPERIMENT/FUTURE/KILL/DUPLICATE with Problem/User/Behavior/Loop-link/Alternative/Cost/Risk/Success-metric/Decision.
- **Done when:** ≥1 squad practices repeatedly without founder prompting, or kill/scope decision documented.
- **Metric:** North star — *Does a real squad repeatedly practice through Mahayuddh?* (§57). Not MAU.

---

## Appendix A — Build order + dependencies
```
0 (CI/hazards) → 1 (RLS/decouple) → 2 (analytics/SEO) → 3 (landing/onboarding) → 4 (IA/home)
→ 5 (squads) → 6 (today) → 7 (dock/battles) → 8 (history) → 9 (approaches) → 10 (challenges v2) → 11 (feed/leaderboard)
→ 12 (primers) → 13 (notebook/vault) → 14 (revision/patterns) → 15 (hubs)
→ 16 (cards) → 17 (revenge/chains) → 18 (stuck) → 19 (compare/goals/seasons) → 20 (recaps/wall/share)
→ 21 (feed surfaces) → 22 (follow/teachers) → 23 (notifs/contests)
→ 24 (reco) → 25 (AI gated) → 26 (growth instrument)
→ 27 (2-week test)
```
Parallelizable after Step 5: Steps 12–13 (knowledge) can run alongside 16–18 (social) with separate owners; both depend on Steps 7–9 contracts (`battles`, `problem_events`, `approaches`). Never parallelize DB contract changes — agree on table shapes first (§63–§66).

## Appendix B — Data philosophy recap (§63–§66)
- Normalized durable entities: users/profiles, squads, squad_members, problems, user_problem_status (current), problem_events (history), battles (sessions), approaches, primers, notebook_notes, note_shares, shared_resources (vault), suggestions/challenges, feed_events (normalized: actor/event/object/squad/metadata/created_at), contests, comments, notifications, follows.
- Battle Card / Recap / Journey = projections, never tables.
- Feed = event rows + metadata, not JSON blobs; archive noise, keep important objects separate.
- Notes = Markdown, list views without bodies, FTS only when justified.
- Schema many-squads-per-user, UX one-active-squad initially; no merged multi-squad feed until needed.

## Appendix C — What we explicitly KILL (§61)
Global realtime chat, generic DMs, live co-editing, own judge, giant video library, massive company-tag DB, complex XP economy, vanity profiles, black-box ranking before content, betting/wagers, AI solution vending, anti-AI police, super-app expansion before DSA proven (§70).

## Appendix D — Per-step agent checklist (§74 R9 + §73)
- [ ] Problem/User/Behavior/acceptance restated
- [ ] Existing component reused (file paths noted)
- [ ] Privacy model stated (who sees what, reversible?)
- [ ] Abuse considered (spam, spoiler, gaming)
- [ ] Empty state teaches + CTA
- [ ] Error state honest + retry
- [ ] Analytics event added
- [ ] Next action wired (no dead ends)
- [ ] Mobile comfortable
- [ ] Success metric + one-sentence filter (§77) passed
