# Architecture Verdict — Mahayuddh Production Readiness

**Date:** 2026-10-14 · **Status:** review, being executed in waves A–F · **Scope:** full system (Next.js 15 + Supabase Postgres 17 + Vercel Hobby + GitHub Actions + dormant Render free)
**Method:** 5 parallel adversarial reviews (HLD systems, LLD data, LLD app, reliability, cost/scale) + live Supabase advisor scans + platform-docs verification. All claims carry file:line evidence.

## 1. Overall verdict

**B+ design, C execution readiness. Fundamentally sound — do not re-architect.** Async-first, Postgres-as-truth, triggers-for-integrity, RLS-as-read-perimeter, service-routes-as-write-perimeter is the right shape for squads of 2–7. Nothing needs re-platforming. But ~15 deterministic production breaks exist (they fire under normal use, not load), and two earlier assumptions were corrected against current docs (see §2).

## 2. Corrections to prior claims (verified 2026-10-14)

- **Vercel Hobby is 300s default/max with Fluid, not 10s.** The `maxDuration: 60` entries are now *downward caps*: remove them and inherit 300s. AI 20s timeout stands (earlier 8s advice withdrawn). Catalog sync fits; push fan-out drops from P0 to P2.
- **Supabase pause risk is low, backup risk is total.** Pause needs only a few DB requests/day, and the 3h sync cron heartbeats the DB around the clock. But free tier has **zero** downloadable backups (docs explicitly recommend CLI dumps) — the nightly `pg_dump` Action is mandatory, not optional.
- **Failover mechanics verified:** Render `POST /v1/services/{id}/suspend|resume` exist (Bearer, 202); SW `/offline` fallback exists (`sw.js:66-69`). Only unverified step: free-account API key calling them (test with read-only List-services first).
- **Binding constraints, ordered:** egress (~60 DAU) → Nano concurrency (~20 concurrent loads) → invocations (~130 DAU). DB size irrelevant for years. Free runway is quarters, not weeks.

## 3. Holds (decisions that survived adversarial review)

1. Stack stays: Vercel serve + Supabase store + Actions schedule + Render dormant spare. No scale problem lacks a code-level fix first.
2. No cache/queue/worker at this scale; the honesty constraint makes caching dangerous. Sole exception: React `cache()` dedupe of share loaders (same request, zero staleness).
3. SECURITY DEFINER views stay DEFINER, documented (INVOKER would silently undercount cross-user aggregates through own-row RLS; they expose counts + public usernames only).
4. Failover = probe → auto-resume → `/offline` hub + backup button, with dual-origin allowlists/redirects from day one; custom domain later makes it seamless.
5. Password recovery stays provider-token-based; login backoff stays client-friction over provider limits.
6. `getSharedWithMe`, season scans, `getSuggestions` get server-side scoping (never ship device-filtered private rows).

## 4. What WILL break in production (ranked)

**P0 — data integrity:** viewer-local streak days disagree per timezone (`squadActivity.ts:56-66` vs UTC pick `dailyBattle.ts:52`); pause doesn't pause / reset doesn't reset / sleep counts as solving (`NowSolvingBar`, `SolvingProvider`, plain-overwrite heartbeat `battles/route.ts:87-89`); immortal `max()` streaks (two persist sites); challenge-completion forgery via direct RLS update; discussion gates bypassable by direct INSERT; feed forgeable + any-squad readable; review desync for LeetCode-only solvers; milestone single-kind overwrite; status/event divergence on sheet delete; contest fan-out permanent half-skip on crash; client-only remind throttles; AI budget overshoot; forgeable `metadata.source` + unindexed.
**P0 — runtime:** slow-auth redirect loop (2.5s race → bounce → loop); cross-user battle/notes resurrection (signOut clears nothing); ~25 routes without `error.tsx`; recovery accepts any session + fake global-logout; unbounded RPC pagination; unvalidated `external_url`/`avatar_url`; duplicate writes on retry; analytics misattribution.
**P1 — ops:** no backups; laptop-driven migrations with stale `schema.sql`; CI missing `next build` + Node 20-vs-22 skew; contest cron never scheduled; `DEMO2026` 404; fake-23 streak; dead "Not this" button; Hard first pick; `console.*`-only observability (heartbeat lies success, push `sent:0` is 200).

## 5. Recommendations (waves, dependency-ordered)

**A. Correctness (one release, shared semantics):** squad-local days (default `Asia/Kolkata`) across streak/pick/recap/leaderboard/snapshot; monotonic pausable timer + `GREATEST` heartbeat guard + single-tab lock + `23505→return-existing`; real streak decay with fetch-failure distinction; quiet-hours per-user TZ; dismiss/accept/remind/complete `eq(status)` guards; `daysRemaining` inversion fix.
**B. Trust:** EXECUTE revoke on ~50 uncalled DEFINER functions (keep exactly the 17 RPCs the app calls, generated from `pg_proc`); `search_path` ×12; FK index; `journey.ts` client/server split; recovery-session gate + awaited revoke; URL validation + DB checks; `LEAST(p_limit,100)` caps; column projections replacing hot `select(*)`; server-side scoping for the three leak queries.
**C. Scale hygiene:** poll intervals aligned to server cooldowns; remove 60s caps; schedule contest cron; delete dead code/buttons/DEMO; fake-23 removal; Easy first pick; `error.tsx` + `loading.tsx` coverage; `next/image` avatars; confetti lazy-loads.
**D. Growth:** deep-continue `?next=` on all 5 artifact CTAs (+`?ref=` preservation); fire the 4 dormant funnel events + split signup/sign-in; wall-share retarget; post kit (download + copy + tracking); public approach projections; streak-at-risk + lapsed nudges (after quiet-hours fix); contextual push-permission prompt.
**E. Ops backbone:** nightly `pg_dump` Action + restore doc; migration gate + `schema.sql` regen; CI `next build` + Node 22; `/api/health`; probe workflow (resume/suspend + auto-issue); `failed[]`/push/heartbeat observability; runbooks (offset replay, secret rotation, unpause).
**F. Ship:** `hnd1` region, 20-var env parity, merge → CI → auto-deploy → golden-path + header + cron verification → 48h watch.

## 6. Buy order (trigger-gated, never upfront)

Custom domain now (~$12/yr) → Supabase Pro at first real squad ($25: backups + no-pause) → nothing else until metrics fire. Rejected: PITR ($100/mo), Vercel Pro (no trigger), multi-cloud active-active (complexity without a customer).

## 7. Residual risks (accepted, documented)

`HttpOnly:false` sessions (architecture requires it; mitigated by CSP + zero injection sinks); no nonce-CSP (115 inline styles); in-memory limiters per-instance (Postgres counters deferred to scale trigger); overlapping RLS policies + unused indexes (revisit at 10×); free-tier pause (mitigated by cron heartbeat); PITR absent (mitigated by nightly dumps).
