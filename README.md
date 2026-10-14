# Mahayuddh — Practice DSA With Your People

> One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it.

[![CI Gate](https://github.com/prem22k/mahayuddh/actions/workflows/ci.yml/badge.svg)](https://github.com/prem22k/mahayuddh/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-mahayuddh.vercel.app-F5B83D)](https://mahayuddh.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_17-3DDC97)](https://supabase.com)

**Live demo:** [mahayuddh.vercel.app](https://mahayuddh.vercel.app) · **Landing:** [/welcome](https://mahayuddh.vercel.app/welcome)

Mahayuddh is the social practice layer around LeetCode — not a judge, not a roadmap. LeetCode owns judging; NeetCode-style sheets own curation; Mahayuddh owns the loop around actual practice:

**Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return**

Two rules run the whole product: **never gate on LeetCode** (everything works without a connected handle) and **never invent data** (durations, reasons, and standings shown are measured or the UI says so).

## The loop in 30 seconds

- **Arena** — today's battle as a collector-grade Pass: problem, difficulty, pattern, why-this-one reasons, squad social line, one `Start battle` action.
- **Battle** — solve-dock timer, scratchpad, stuck ladder, submit. Verification comes from real LeetCode evidence; self-reported solves look different, always.
- **Proof** — verified solves become shareable Proof cards (1200×630 + 1080×1350) built for screenshots.
- **Squad** — shared streaks, goals, seasons, weekly frozen recaps, 1v1 challenge Passes, activity feed, leaderboard with real rank deltas.
- **Knowledge** — pattern hubs, 8-minute primers, approach write-ups with reveal-gated code, personal notebook + shared vault.

## Design

`DESIGN.md` (v4) owns every token: obsidian canvas, hairline-layered surfaces, one warm gold for action, emerald for verified proof, indigo for knowledge. Space Grotesk for display, Geist for UI, JetBrains Mono for measurement. The signature artifact is the **Pass** — body + perforated stub, never used for anything else.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript strict) |
| Styling | Tailwind CSS v3 + Lucide icons |
| Database & Auth | Supabase (PostgreSQL 17, RLS everywhere) |
| Data engine | LeetCode GraphQL (unofficial, optional, politely rate-limited) |
| AI hints | Ladder-capped assistant (OpenAI / Anthropic / Gemini via OpenAI-compatible wire) |
| Push | Web Push (VAPID) + in-app bell |
| State | React Context (`AuthProvider`, `SolvingProvider`) + localStorage persistence |
| Deploy | Vercel Tokyo region (Render free tier as cold spare) |

## Project map

| Doc | What it owns |
|---|---|
| `PRODUCT.md` | Users, loops, constraints, terminology |
| `VISION.md` | Full ideation record and build plan history |
| `DESIGN.md` | The entire visual system (v4, current) |
| `ARCHITECTURE_VERDICT.md` | Production-readiness review, holds, and residual risks |
| `STITCH_PROMPTS.md` | Screen-by-screen UI spec catalog |
| `docs/RUNBOOK.md` | Sync replay, secret rotation, unpause, failover |
| `docs/RESTORE.md` | Backup restore procedure (RPO 24h) |
| `MAHAYUDDH_EXECUTION_PLAN.md` | Original phased build plan |

## Route map

| Route | Surface |
|---|---|
| `/home` (and `/`) | Arena — today's battle, squad, challenges, feed |
| `/practice`, `/practice/[slug]`, `.../compare` | Review queue, problem workspace, squad comparison |
| `/patterns`, `/patterns/[topic]`, `/primers` | Pattern hubs, primers index + reader |
| `/approach/[id]`, `/a/[id]` | Approach reader (private + public projection) |
| `/challenges`, `/c/[id]` | 1v1 challenges inbox and public deep link |
| `/squad`, `/squad/join/[code]`, `/squad/[id]/...` | Squad hub, invites, wall, recaps, seasons |
| `/feed`, `/leaderboard`, `/notebook` | Activity feed, standings with snapshots, notebook + vault |
| `/sheets/[slug]`, `/stuck`, `/profile` | Roadmaps, tiered peer help, settings |
| `/b/[id]`, `/u/[username]` | Shareable proof cards, public portfolios |
| `/welcome`, `/login`, `/offline` | Landing, auth (+password recovery), offline hub |

`/` → `/home`, `/suggestions` → `/challenges`, `/vault` → `/notebook?tab=vault`
are permanent redirects, so old links keep working.

## Database

Postgres 17, RLS on all ~45 tables, ~65 functions, ~25 triggers. The recurring shapes: own-row writes, three-level reads (private / squad / public), append-only event history, no client writes to analytics/rate-limits/notifications.

Two setup paths — **pick one** (they are not composable: migrations assume `profiles` exists):

- **Fresh database** → run `supabase/schema.sql` in the SQL editor, then seed below.
- **Existing project** → `npx supabase link` + `db push` (dry-run first). Never hand-edit an applied migration.

Then seed the catalog and roadmaps:

```bash
npm run sync:catalog   # ~4k LeetCode problems
npm run sync:sheets    # NeetCode 150, Blind 75, Striver SDE
```

Key tables: `profiles` (identity + synced stats) · `problems` (catalog, read-only to clients) · `user_problem_status` (current state) · `problem_events` (append-only history, never rewritten) · `battles` (sessions, one live timer per user) · `suggestions` (challenges) · `approaches` / `primers` / `notebook_notes` / `shared_resources` (knowledge, visibility-tiered) · `feed_events` (normalized pointers, never blobs) · `notifications` (no client INSERT).

## Security posture

20-point baseline, enforced in code and asserted in tests: fail-closed CSRF middleware, per-route body ceilings, in-memory + Postgres rate limits, constant-time secrets, bounded AI budgets with ladder ceilings checked three times (gate → output clamp → DB trigger), generic auth/recovery responses (no enumeration), global session revoke on password change, security headers as assertable data. Details in `ARCHITECTURE_VERDICT.md §5`; abuse suite in `tests/security/`.

## Getting started

```bash
git clone https://github.com/prem22k/mahayuddh.git
cd mahayuddh
npm install
```

Create `.env.local` (see `.env.example` for the full annotated template — 20 vars, most optional):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-only; bypasses RLS
CRON_SECRET=your-random-hex                      # protects background endpoints
LEETCODE_SESSION_SECRET=min-16-chars
NEXT_PUBLIC_SITE_URL=https://your-domain
# Optional: GEMINI_API_KEY (AI hints) · VAPID keys (push) · OPENAI/ANTHROPIC keys
```

```bash
npm run dev        # http://localhost:3000 → /home
```

### Verify your setup

```bash
npm run lint && npm run typecheck && npm run test:smoke && npm run test:security && npm run build
```

All five must pass — CI enforces them on every push to `main` and every PR:

| Command | What |
|---|---|
| `test:smoke` | 240 contract tests over the real modules (node:test, zero deps) |
| `test:security` | 84 abuse-case tests (enumeration, forgery, throttles, token handling) |
| `test:integration:*` | Live-DB suites (battles, feed, notebook, notify, AI gates…) — intentionally out of CI |
| `test:ai:provider` | AI wire-format + guardrail tests against mocks |

### Background jobs

```bash
npm run sync:all        # catalog + sheets, manual
```

In production, `.github/workflows/sync.yml` runs the LeetCode sync every 3h, the catalog weekly, and streak nudges daily; `backup.yml` dumps irreplaceable tables nightly; `probe.yml` health-checks prod every 5 min with Render failover. All need `APP_URL` + `CRON_SECRET` (+ `RENDER_API_KEY` for failover) as repo variables/secrets.

## Deploy

Vercel Hobby, Tokyo region (beside the DB). Push to `main` → CI gate → auto-deploy. Required Vercel env: Supabase URL/keys, service-role key, `CRON_SECRET`, `LEETCODE_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`; optional: AI keys, VAPID keys. Supabase Auth dashboard must allowlist `<site>/auth/callback`. Render free tier holds a suspended, pre-verified spare (`render.yaml`).

## Contributing

Small modular commits, conventional style (`feat(scope): …`). Typecheck + security suite must stay green. Never invent data in UI; never weaken a security control to make a test pass.

## 📄 License

MIT — see [LICENSE](LICENSE). Built for developer squads who practice together.
