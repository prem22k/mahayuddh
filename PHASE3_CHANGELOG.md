# Phase 3 Changelog — Steps 16–20

**Branch:** `phase-0-2-gap-closure`, unpushed. Phase 3 is the last 8 commits; `git log main..HEAD` covers the full branch.
**Scope:** Phase 3 of `MAHAYUDDH_EXECUTION_PLAN.md` — Steps 16 through 20.
**Bible refs:** §14 (primers), §31 (squad recaps), §32 (squad wall), §33/§34 (no winner framing), §38 (shareable artifacts), §40 (WhatsApp/Discord distribution), §42 (challenge deep link), §49 (personal journey), §56 (Loop B share attribution), §63 (projections are not tables), §64 (feed stores no blobs).

Phase 0–2 is covered by the 19 earlier commits on this branch and is not repeated here.

---

## Step map

| Step | Commit | What shipped |
|---|---|---|
| 16 Battle Card | `b1ef08a` | Public `/b/[id]`, OG image, wired share actions |
| 17 Revenge | `7d94cd6` | Revenge offers + completion, challenge chains, longest live chain |
| 18 Stuck ladder | `c2b20c2` | `stuck_requests` / `stuck_replies`, DB-enforced ladder, `/stuck` |
| 19 Compare | `e5e03d9` | `/practice/[slug]/compare`, neutral technique grouping |
| 19 Goals/seasons | `e5e03d9` | Multiple windowed goals, `squad_seasons`, ritual config |
| 20 Recaps + Wall | `6514323` | Weekly recap projection, trigger-written squad wall |
| 20 Journey + sharing | `84be0a0` | `/u/[username]`, public frozen recaps, Loop B `?via=` attribution |
| 26 Primer sharing | `2eeec08` | Primer OG, visibility-gated sharing, real 404s |
| 20 Wall fix | `4190498` | Solve-count milestones moved onto `problem_events` |

---

## Step 16 — Battle Card (`b1ef08a`)

One solve becomes a shareable object.

- `lib/battleCard.ts` — pure projection (`buildPublicCard` / `buildPublicBattleCard`). No I/O, fully testable.
- `app/api/battle-cards/[id]/route.ts` — privacy-aware API.
- `components/battle/BattleCard.tsx` — solved/failed UI with real actions.
- `app/b/[id]/page.tsx` + `app/b/[id]/opengraph-image.tsx` — public share surface.

**Privacy boundary.** The public projection excludes scratchpads, squad identity, and approach text. A battle card is the one artifact that can leak a whole squad's practice if it is built with the wrong select list.

---

## Step 17 — Revenge (`7d94cd6`)

A failed problem becomes a reason to come back.

- `lib/revenge.ts`, `lib/data/revenge.ts` — derivation + persistence.
- `lib/chains.ts` — chain state machine, `longestActiveChain`, `chainHops`, ordering.
- `lib/format.ts` — pure formatting consolidated here (`formatDuration`, `relativeDays`, `daysBetween`) rather than duplicated per feature.

---

## Step 18 — Stuck ladder (`c2b20c2`)

The ladder becomes a real contract, not a popover.

- `supabase/migrations/20261003000003_stuck_ladder.sql` — `stuck_requests`, `stuck_replies`, level constraints, rate limits.
- `lib/stuckLadder.ts`, `lib/data/stuck.ts`, `components/battle/StuckLadder.tsx`, `components/battle/StuckBoard.tsx`, `app/stuck/page.tsx`.

The ladder state is enforced by the database, not by the client, so it cannot be skipped by calling the API directly.

---

## Step 19 — Compare, goals, seasons, rituals (`e5e03d9`)

- `lib/approachCompare.ts`, `app/practice/[slug]/compare/page.tsx` — technique grouping with **no winner framing** (§33 squad leaderboard is for accountability and friendly competition; §34 rejects global ranking, and the plan's §22 ban rules out any single skill score). It reports how people approach a problem, never who is better.
- `supabase/migrations/20261003000005_seasons_and_goal_window.sql` — multiple concurrent windowed goals.
- `lib/data/goals.ts`, `lib/rituals.ts` — goal progress, `squad_seasons`, ritual configuration. Ritual configuration is user-set; there is no automation.

---

## Step 20 — Recaps and Wall (`6514323`)

### Weekly recap — `lib/recap.ts` (pure), `lib/data/recap.ts`, `app/squad/[id]/recaps/page.tsx`

A frozen projection of one week, stored in `squad_recaps.body_json` so it stays shareable after the week ends.

The honesty rules are the feature:

- A quiet week says so. `headline` is `"A quiet week. Nobody logged a solve."` and empty sections are listed under **Did not happen**. A recap padded to look productive is a lie with a timestamp on it.
- People who solve but never challenge get: *"nobody challenged anybody — the loop is only half running."* Naming the half-working loop is more useful than a green number.
- `biggestImprovement` requires two solves by the **same person** on the **same problem** with **both durations recorded**. It never compares across people and never infers a speedup from a missing time. Four tests pin those three refusals.
- Every recap names the week it covers, so a shared recap cannot be read as "this is happening now".

### Squad wall — `lib/data/wall.ts`, `app/squad/[id]/wall/page.tsx`

Milestones written by database triggers on the events that earn them:

`first_member` · `first_challenge` · `first_solve` · `milestone_solves` · `milestone_solves_100` · `goal_complete` · `season_complete`

Trigger-written means the wall cannot be back-dated into looking better than it was. `on conflict do nothing` makes the first-only milestones real, so a re-join does not reset history.

---

## Step 20/26 — Sharing and attribution (`84be0a0`, `2eeec08`)

### Attribution

§38 asks for artifacts worth sharing outside the app; §56 defines the share loop. Before this, a signup arriving from a shared battle card was indistinguishable from one arriving from anywhere else, so *"does sharing work"* had no answer available to it.

- `lib/share.ts` — pure. `viaSlug`, `artifactPath`, `withVia`, `shareTargets`.
- `lib/shareSource.ts` — local attribution store, storage injected so the rules are testable without a browser.
- `components/ui/TrackVisit.tsx` — reads `?via=` on public surfaces.
- `app/login/page.tsx` — consumes it at signup and **shows it to the visitor** rather than quietly using it.

Every generated link carries `?via=<kind>:<id>`. The slug is a type plus an id and nothing else, so a link cannot smuggle a referrer into the stream. The record expires after 30 days and is consumed exactly once. A clock skewed into the future reads as expired rather than as extra time.

### Distribution — `components/ui/ShareRow.tsx`

OS share sheet, copy-link, and WhatsApp / Telegram / LinkedIn / X intents. Discord is deliberately absent: it has no public share intent, so the honest route is the copy button, labelled for it. A share press fires `share_clicked` once regardless of affordance — copied and posted are the same decision from the loop's point of view.

### Public surfaces

| Route | Public | Notes |
|---|---|---|
| `/b/[id]` | yes | Battle Card + OG |
| `/u/[username]` | yes | Personal Journey + OG. Returns 404 when there is nothing worth sharing |
| `/squad/[id]/recaps/[recapId]` | yes | Reads only the stored projection. **The list** `/squad/[id]/recaps` stays authenticated because it offers the generate button |
| `/primers/[slug]` | yes, when `visibility = 'public'` | §14 primers. RLS keeps squad primers out of anonymous reach. `/primers` itself stays authenticated |

### Personal Journey — `lib/journey.ts`, `lib/data/journey.ts`, `app/u/[username]/page.tsx`

A 30-day projection (§49), built as a projection rather than a table (§63). Three refusals, each tested:

- Patterns come from the catalog or not at all. No guessed topic names.
- Revenge requires a failure that **precedes** the solve.
- A median solve time is `null` when no durations were recorded.

---

## Bugs found and fixed

Every one of these was found by exercising the real thing, not by reading the code.

### Database triggers

| # | Bug | Effect | Fix |
|---|---|---|---|
| 1 | `record_solve_stuck_on_solve` read `new.battle_id`, which `battles` has no such field for | **Every battle solve failed** | `20261003000004` |
| 2 | `record_first_challenge_milestone` read `new.squad_id`, which `suggestions` does not have | **Every challenge insert failed** | `20261003000007` |
| 3 | Same trigger picked one squad via `ORDER BY joined_at LIMIT 1` | Arbitrary when two people share several squads | Records for every shared squad |
| 4 | `record_solve_milestone` used nullable `new.ended_at` for NOT NULL `occurred_at` | **Every battle solve failed** | `20261003000009`, `coalesce(..., now())` |
| 5 | `milestone_solves` was used for both 50 and 100 | 100 could never land — unique index is per `(squad, kind)` | Own kind `milestone_solves_100` |
| 6 | Solve-count milestones fired on `battles` but counted `problem_events` | See below | `20261003000010` |

#### Bug 6 in detail

The app writes the two rows as independent, unordered, fire-and-forget requests — `NowSolvingBar.handleComplete` calls `endBattle(...)` and then `logProblemEvent(...)`, neither awaited.

Measured against the live database: with 49 solve events, then the battle update, then the 50th event, the user is **on 50 logged solves and the wall is permanently silent**. Nothing re-fires when the late event arrives.

The second failure was worse. A solve logged from the roadmap matrix or a sheet batch writes a `problem_events` row and **no `battles` row at all** — a battles-only trigger cannot see those, so somebody could push themselves past 50 solves and the wall would never notice. The threshold was rewarding opening a battle session, not solving, which is not what a solve-count milestone claims to be.

Fixed by moving the trigger onto the insert that defines the count, so the threshold is exact inside the same transaction as the row it counts. `first_solve` stays on `battles` — it is a statement about a battle, not a count.

### Application code

| # | Bug | Effect | Fix |
|---|---|---|---|
| 7 | `buildJourney` compared challenge parties against a hardcoded `"me"` | Every sent/received/answered count was wrong | Real user id passed explicitly |
| 8 | Journey summary keyed off battles | "No battles" displayed beside three recorded solves, because a roadmap solve has no battle session | Keys off solves |
| 9 | `URLSearchParams` escapes `:` to `%3A` | Every share link read as `?via=battle%3A9f3c` | Separator kept literal, id encoded |
| 10 | `notFound()` called inside a `try/catch` | It signals by throwing, so the catch swallowed it and the 404 stayed a 200 | Call moved outside the try |
| 11 | Missing primer returned 200 | Soft 404 on public, indexable URLs — crawlers index every guessed slug | Layout 404s on absent rows |

### Infrastructure

**Migration history trap.** A diagnostic migration consumed timestamp `20261003000008`. Renaming the real fix to that same timestamp made the CLI report "up to date" and silently skip it. Resolved with `supabase migration repair --status reverted 20261003000008`; the fix then shipped as `20261003000009`. Verified afterwards — every remote version has a local file and no stray `reverted` row remains.

---

## Verification

```bash
npx tsc --noEmit          # clean
npm run lint              # no warnings or errors
npm run test:smoke        # 118/118
npm run build             # compiled, 32/32 static pages
npm run test:integration:wall   # 5/5 against the live database
```

### Public routes, checked logged out

| Route | Status | Why |
|---|---|---|
| `/primers/sliding-window` | 200 | Public primer renders for a logged-out visitor |
| `/primers/no-such-primer-zzz` | 404 | Real 404, not a soft one |
| `/primers/` | 308 | List stays authenticated |
| `/u/nope` | 404 | Nothing worth sharing |
| `/squad/a/recaps/b` | 404 | Public share route, correctly 404s on missing data |
| `/squad/a/recaps` | 307 | List stays authenticated |

### `tests/integration/wallMilestones.mjs`

Runs against the **live** database and is deliberately not part of `test:smoke`, which stays pure and hermetic. It creates throwaway auth users and deletes every row it made, including on failure.

1. 50 solves with events before the battle update — milestone recorded.
2. **The regression guard:** 49 events, then the battle update, then the 50th event — milestone recorded even when the battle update won the race.
3. 100 solves — both kinds present, 100 does not overwrite 50.
4. 50 solves with **no battle session** — still reaches the wall.
5. 60 failures — not 50 solves.

---

## Test count

88 → 118 across Phase 3. Every new number is a behaviour the plan forbids or requires, not a coverage metric.

---

## Known follow-ups

- **Squad battle timeline and the leaderboard split** (§33) are Phase 4 territory; the neutral comparison in Step 19 does not yet feed the leaderboard.
- **Feed composer** is still partial — the six structured tiles are not all built (Step 21).
- **`teacher_stats`** materialized view and the follow/mentor layer (§21) are not built; `/u/[username]` is a journey projection only.
- **Primer share artwork** uses the pattern and title only, never the mental model or template. This is intentional: "share" must not quietly become "republish".