# Phase 4 Changelog — Steps 21–24

**Branch:** `phase-0-2-gap-closure`, unpushed. Phase 4 is the last 4 commits; `git log main..HEAD` covers the full branch.
**Scope:** Phase 4 of `MAHAYUDDH_EXECUTION_PLAN.md` — Steps 21 through 24.
**Bible refs:** §14 (primers), §19 (feed surfaces), §20 (feed ranking), §21 (following/mentor), §22 (reputation), §24 (recommendation engine), §31–§32 (recaps/wall), §34 (leaderboard anti-problem), §36 (contests), §37 (notifications), §38 (shareable artifacts), §40 (distribution), §49 (personal journey), §50 (anti-ghost-town), §51 (anti-noise), §56 (Loop B), §63 (projections), §64 (feed storage).

Phase 3 is covered in `PHASE3_CHANGELOG.md`. Phase 0–2 is the 19 earlier commits and is not repeated.

---

## Step map

| Step | Commit | What shipped |
|---|---|---|
| 21 Feed surfaces | `c11f4f8` | Four ranked feeds, six-tile composer, §51 anti-noise, moderation primitives |
| 22 Reputation | `fb1ad8a` | `teacher_stats` as five dimensions with no total, follows, teacher discovery |
| 24 Recommendation | `416b03d` | Hand-weighted engine, prerequisite map, plateau detection, recommendation log |
| 23 Notifications | `f1dd8db` | Trigger-written notifications, contests ritual, segmented leaderboard |

---

## Step 21 — Feed surfaces (`c11f4f8`)

### Ranking (§20), in SQL

`public.get_ranked_feed` returns rows scored by downstream actions only:

| Signal | Weight | What it measures |
|---|---|---|
| Copies | 4 | `notebook_notes.fork_of` pointing at the shared object |
| Challenge completions | 3 | `suggestions` with `status = 'completed'` |
| Revisits | 2 | `problem_events` revisited/solved on the same problem |
| Pattern linkage | 2 | Object type is `primer` or `approach` |
| Discussion depth | 1 | Replies on a discussion the author started |

Decayed over a ~7-day curve so a good resource ages without disappearing.

**Likes are excluded structurally, not by weighting.** The schema has no likes column, so there is nothing to weight. If somebody adds one, it does not enter this expression — which is the argument for writing the ranking in SQL: the rule is legible in one place.

Blocks and a viewer's own reports are filtered **in SQL**. Filtering in the client still ships the blocked activity to the device, which is not what "block" means to the person who used it.

### Four scopes

Squad is default (§19). Following required a `follows` table, built here rather than deferred to Step 22 — a tab that renders nothing is the dead affordance this codebase already refuses to ship. Platform lives in `platform_posts`, separate from activity, because a maintenance notice is not something a developer did and must never be ranked as if it were.

### Anti-noise (§51), enforced in the database

Problem-linked, pattern-linked, actionable, rate-limited, min solves to post globally. Only **Discuss** accepts prose; every other composer tile creates an object that already exists. §50 warns a feed needing "content creators" will die, so nothing in the default path requires writing anything.

### Metric instrumentation

`feed_view` is the denominator and `feed_action` is the numerator, deliberately separate event names. Reusing one name for both would make the useful-action rate always 1 by construction.

---

## Step 22 — Reputation (`fb1ad8a`)

§22: *"Do not compress these immediately into a single 'skill score.' A single score creates false precision and invites gaming."*

That is enforced in three places, not by convention:

1. `public.teacher_stats` has **no** total, score, rank, points or level column. Checked against the live view by an integration test that probes for exactly those names and fails if any exists.
2. `lib/reputation.ts` exposes no function returning a single number. There is no `reputationScore()` to reach for.
3. `NO_SINGLE_REPUTATION_SCORE` exists as a marker so re-litigating the ban has an obvious place to happen.

Every dimension carries its own definition. Verified solves are counted apart from self-reported ones, so the number reads "80 verified, 120 logged" rather than an unqualified "80".

The pattern-page teacher list is ordered by **forks and completed challenges**, in SQL. Not followers, and not a collapsed score — §21 asks for "useful to learn from" over "most followers".

---

## Step 23 — Notifications and leaderboard (`f1dd8db`)

### Notifications (§37)

Triggers write rows for the two kinds §37 names as good — *"Rahul challenged you"*, *"Your challenge was completed"* — and nothing else. No trigger here can produce a notification nobody could act on.

Low-noise is structural: every row carries a `dedupe_key` against a partial unique index, so a goal nudge cannot stack however often it fires. That is the "max 1/day" requirement done by the database rather than by a cron guard somebody could forget.

**Push is delivered by the app reading unread rows**, not from the trigger. A Postgres trigger cannot call `lib/push.ts`, and an HTTP extension for six notification kinds is a lot of machinery to avoid one round trip. `/api/push/deliver` takes a notification id rather than arbitrary text, so it cannot be used as a push relay for content that is not the caller's own notification.

Quiet hours (22:00–08:00 UTC) suppress advisory nudges. Direct person-to-person notices ignore them — ignoring somebody who just challenged you is its own kind of noise.

### Leaderboard segments (§34)

The old global tab loaded every profile and sorted in the browser, so row one was always whoever had solved the most ever, for every visitor. That is precisely the feeling §34 is about.

Segments now: **Rising** (30-day solves), **Most improved**, **By pattern**, **Recently active**, **Most solved**. The landing segment is chosen by the database from the viewer's own history — a beginner gets `rising`, somebody with 500+ lifetime solves gets `most_solved`. "Most solved" still exists because hiding it would be its own kind of lie; it is opt-in, paginated, and labelled as a lifetime tally.

Every row states what it was ranked by. A number with no stated basis is how people end up feeling arbitrarily badged.

### Contests (§36)

`contests` with manual ingest only — the plan says no scraping, and scraping leetcode.com would be both fragile and a terms problem. A unique index on `(starts_at, platform)` means re-running the calendar script cannot create duplicate reminders. The reminder function is idempotent by dedupe key so the cron can run it as often as it likes.

---

## Step 24 — Recommendation engine (`416b03d`)

"Next battle: Number of Islands — Why: Graph low, 12 days gap, prerequisite done."

§24's done criterion is "4/5 recommendations have ≥2 truthful why-bullets". A recommendation with invented reasons is worse than none — it teaches people to click without reading, and then the reason never mattered. So **each signal returns its bullet or nothing**: no "recommended for you", no filler, and `reasonCount` is shown in the UI so a one-reason recommendation looks as thin as it is.

### Prerequisites, hand-authored (`lib/patternPrereqs.ts`)

§24 says static and hand-authored, and it is also the defensible choice: a learned prereq graph would be wrong in a way nobody could argue with, whereas a disagreement here is a one-line edit.

The alias table folds the two vocabularies the app actually has onto canonical names, **measured against the live catalog rather than guessed**: topics say `Array`, sheets say `Arrays & Hashing`, categories say `Stack and Queue`.

### Plateau is deliberately narrow

At least three attempts AND at least two timed solves. Without two measurements there is nothing to be flat about, and "you have failed this five times" is a failure count, not a plateau. Ordering matters too, so `buildSignalsFromEvents` sorts chronologically.

### The log is how the weights get corrected

`recommendation_log` stores the bullets verbatim beside `shown`/`accepted`/`dismissed`. Storing only the decision leaves no way to tell "ignored because wrong" from "the reason that mattered is the one we deleted". RLS keeps it private to its subject.

Accept rate returns `null` rather than `0` when nothing was ever shown — "0% accept rate" after zero recommendations is a factually wrong thing to show somebody.

---

## Bugs found and fixed

Every one of these was found by exercising the real thing.

### Database

| # | Bug | Effect | Fix |
|---|---|---|---|
| 1 | `notify_contest_reminders` referenced the FOR-loop target `c` in its own query's `WHERE` | `record "c" is not assigned yet` — **the contest reminder could not fire at all** | `20261003000019` |
| 2 | "Most improved" selected `last_sec >= first_sec` and labelled the rows "problems got faster" | The segment listed the people who improved *least* | `20261003000020` |
| 3 | Tiebreak on `problem_events.id` — a random uuid, not a sequence | 300s→900s counted as an improvement whenever the 900 uuid sorted lower. Flapped between runs | `20261003000021` |
| 4 | `feed_reports` had a composite `UNIQUE` over a nullable column | Duplicate discussion reports sailed straight past the constraint | Partial unique indexes |
| 5 | `feed_reports` FK referenced `discussions` created after it | Migration ordering failure | Reordered |
| 6 | Actionability check used `OR` between "has an action" and "is low quality" | Matching a §51 low-quality phrase made a post **actionable** | `20261003000014` |
| 7 | `notifications.notify_goal_near_complete` used `set project_path` | Typo, trigger failed to create | Corrected |
| 8 | `(remaining = 1 ? 'solve' : 'solves')` | MySQL ternary, invalid in Postgres | `CASE WHEN` |
| 9 | `primers.fork_count` referenced but never created | Migration failure | Counted from the `notebook_notes` copies a primer fork actually creates |
| 10 | `Matrix` key declared twice in the prereq map | Second silently overwrote the first | Duplicate removed |

Bug 3 deserves a note: there is **no correct order to recover** for two solves inside the same millisecond. The segment now declines to claim anything when `min(created_at) = max(created_at)`. Batch imports therefore produce no improvement claims, which is conservative and correct — the alternative was asserting an improvement rate the data cannot support. Verified on three consecutive runs.

Bug 2's companion detail: my integration test asserted the same inversion, so the bug was **pinned in place by its own test** rather than caught by it.

### Security

| Bug | Effect | Fix |
|---|---|---|
| `profiles` has a blanket self-update policy, so adding `is_product_admin` as a plain column would let **any user promote themselves** and post platform announcements | Privilege escalation | `guard_product_admin()` trigger; verified live that the attempt fails and the flag stays false |

### Application

| # | Bug | Effect |
|---|---|---|
| 11 | Client data module imported `getServiceClient` | `next/headers` in the browser bundle, build failure. Happened twice in two files |
| 12 | Composer previewed the solve gate from `profiles.total_easy` (LeetCode easies) instead of logged solve events | Somebody with 50 synced easies told they were ready, then refused |
| 13 | `canonicalPattern` returned unknown names raw, so `prereqsFor("graphs")` was empty for a pattern the file knows | Prerequisites silently skipped |
| 14 | `notFound()` called inside a `try/catch` | It signals by throwing; the catch swallowed it and the 404 stayed a 200 |
| 15 | `key` remount on the composer's async solve count | Would wipe a draft the user had already typed |
| 16 | `feed_view` reused as the numerator of its own rate | Useful-action rate would be 1 by construction |

---

## Verification

```bash
npx tsc --noEmit                        # clean
npm run lint                            # no warnings or errors
npm run test:smoke                      # 164/164
npm run build                           # compiled, 32/32 static pages

npm run test:integration:wall           # 5/5    live database
npm run test:integration:feed           # 23/23  live database
npm run test:integration:teacher        # 14/14  live database
npm run test:integration:notify         # 28/28  live database
```

The four `tests/integration/*` suites run against the **linked** Supabase project. Each creates throwaway auth users and deletes every row it made, including on failure. They are deliberately not part of `test:smoke`, which stays pure and hermetic.

### Notable assertions

- **§22 ban:** `teacher_stats` exposes no `total`, `score`, `rank`, `points` or `level` column — probed by name against the live view.
- **§34:** a beginner's default leaderboard segment is `rising`; someone with 550 lifetime solves gets `most_solved`.
- **§37:** re-saving a challenge's status does not re-notify; re-running the contest reminder sends nothing new; re-ingesting a contest start time is refused.
- **§51:** "Try this, but check this out" is rejected — an action word plus a bait phrase is still low quality.
- **§51:** a blocked author's event never leaves the database.
- **Ordering:** two solves sharing one timestamp make no improvement claim.
- **Determinism:** the recommendation engine returns the same pick across repeated calls, and the leaderboard suite passes on three consecutive runs.

---

## Test count

118 → 164 unit tests across Phase 4, plus 70 live-database checks in four suites. Every new number is a behaviour the plan forbids or requires.

---

## Known follow-ups

- **Step 25 (AI, gated)** is not started. Its guardrails in the plan are the right shape — no auto-posting, no mass primer generation, spoiler gates, cost caps — and `ai_enabled` does not exist yet.
- **Step 27** (two-week real-user test and its gates) requires actual users and cannot be completed from here. This is the only Phase 4 item that is blocked on something other than code.
- **Contest ingest** has no script yet — the table and the reminder function are ready, but nothing populates `contests`. Until it does, no contest reminder can ever fire.
- **Notification push** has never been exercised against a real FCM endpoint. The delivery route and the subscribe route exist; the browser-side service worker registration path is untested end to end.
- **The composer is navigation, not creation.** Five of the six tiles link to where the object gets created rather than creating it in place. The plan's wording ("each creates correct underlying object + feed event") is met by the underlying create paths, not by the tile itself. In-place creation would be the honest fulfilment.
- **`recommendation_log` is written but never read.** The accept rate exists as a function and is not yet shown in the UI or queried, so the weights have not actually been validated against behaviour — which is the whole point of logging them.