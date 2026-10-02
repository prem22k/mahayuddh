# Step 27 — Making the gates answerable (`31017ca`)

Bible §58, §59, §60, §76.

## What Step 27 actually is

Two weeks. 3–5 real squads. Observe four times: can everyone understand what to do
(day 1), has someone naturally challenged someone (day 3), do people return
voluntarily (day 7), does the squad have a meaningful history (day 14).

**None of that can be built.** There is no way to ship three to five real squads and
there is no way to make somebody say "this is where we do DSA". This step does not
pretend otherwise, and the one gate with no automated answer is carried on screen
labelled **human only** rather than quietly omitted — because a gate that vanishes
from a dashboard reads as counted-and-lost, and its absence should be a decision.

What *is* buildable is everything the gates measure, and §76 requires answers rather
than impressions:

> Are users practising more? Are squads interacting? Are they returning? Are new
> people joining through existing users?
>
> **If the answer is no, stop adding surface area.**

Without a query behind each question that sentence is unenforceable. So this step
ships the instrument, and leaves the two weeks to the people.

## The rule that shaped every design choice here

**A gate with nobody to measure is `unknown`, never `fail`.**

"0% activation" over an empty squad is a division by zero wearing a suit. §76 says a
no means stop adding surface area — so a board that manufactures noes from an empty
roster argues for deleting a product nobody has tried yet, and a board that
manufactures yeses argues for building more of it. Both are confidently wrong.

This is enforced at two levels: the SQL functions return **no row** when the scope has
no members, and `buildGates()` maps a missing row to `unknown`. The live check asserts
the SQL half directly.

## The gates (§58)

| Gate | Measured | What it cannot tell you |
|---|---|---|
| Activation | Battles started, median hours to first | That anybody understood *why* |
| Social | Challenges sent & completed | **These are prompted** — the product says "challenge someone" in six places, so the count is not §58's "without being instructed" |
| Learning | Approaches written, primers, things copied | **Reading at all** — a primer opened and closed leaves no row |
| Retention | Distinct weeks with a solve in 21 days | A member returning vs. one background job |
| Organic | Accounts joined via an attributed invite | An invite that went somewhere else entirely |

Each gate carries its own limitation on screen. "Learning" passing is the clearest
trap: it counts writes and copies, and says so, because reading is invisible in the
data and a dashboard that implies otherwise would be lying by aggregation.

**Organic only became measurable at Loop D.** Before it, a signup arriving through an
invite link could not be tied to the inviter, so the answer was unknowable in both
directions. That gate exists because of the previous step.

## §59 — the observation log

The record the test actually depends on: where people hesitated, what they ignored,
what they kept asking for, what they do outside the app instead.

Deliberately **free text plus a loose category**, not a fixed taxonomy. §59 says user
behaviour outranks founder imagination, and a rigid category list forces the observer
into the app's own vocabulary — which is the thing under test. `ignored` exists
because silence is data.

Private to the observer and platform admins. A participant's hesitation is not
something the product should display to another squad.

## §60 — triage as a table, not a document

A decision that lives in a wiki gets re-litigated in a meeting instead of being read.
So each feature carries a label (CORE / SUPPORT / EXPERIMENT / FUTURE / KILL /
DUPLICATE) and the nine recorded fields, with a live completeness counter — because
"we decided on this one" and "we filled in all nine" are different claims.

World-readable, admin-writable. A label is a commitment.

## Not in the sidebar

The nav maps to intent (§52), and this is not a member intent. §77 asks whether a
thing makes someone more likely to practise, learn, challenge, teach, improve or
return — a validation dashboard does not. It lives at `/validation`, out of the way,
and that is the correct amount of prominence for a research tool.

## Three more bugs, found by asking whether this was any good

**The social gate claimed to measure something it does not.** Its detail line read
*"No surface in the product instructs sending a challenge, so these are unprompted."*
That was written from the shape of the code rather than from the product, and it is
false in six places: post-solve "Challenge someone", "Solved — now explain it,
challenge someone", "Challenge a Friend", two empty states, a leaderboard prompt and
a home prompt. So the number measures prompt-following while claiming to measure
spontaneity — which makes it weaker evidence than it looks, and §59's actual day-3
question ("has someone *naturally* challenged someone") is not answerable from SQL at
all. Corrected in `00032`.

**"Save decision" silently threw a non-admin's work away.** `decideTriage` checked
`error` only, and PostgREST returns *no error* for an RLS-filtered UPDATE — zero rows,
no exception. So a non-admin typed all nine §60 fields, clicked Save, saw a success,
and the notes were gone. The form now checks the row count and says so explicitly.
This is the same PostgREST behaviour my own test caught; I fixed the test and left the
shipped data layer broken.

**Nobody but an admin could propose a feature.** One `for all` policy made the whole
queue admin-only, so the researcher collecting requests during the two-week test
could not file the request they heard three times in one afternoon. §60 says *every*
proposed feature gets a label — proposals come from whoever notices something, the
label is the commitment. `00033` opens INSERT to any signed-in user, and adds a
trigger so the label cannot be smuggled in on insert, because the insert policy cannot
check it and the rule belongs in the database rather than in the client that happens
to be polite.

All three were found by driving the forms, not by reading them. I had verified the
page *rendered* and no console errors appeared, and treated that as verification.

## Four bugs, and one of them was in the test itself

**Gates reported failure for empty squads.** `gate_activation` had a
`HAVING count(*) > 0` guard. When `gate_social` was rewritten as a scalar aggregate
the guard was lost, and `gate_learning`, `gate_retention` and `gate_organic` never
had one — so all four returned `passed = false, measured = "0 challenges sent",
detail = "No members yet."` The detail was honest and the verdict was not: the board
showed 4 fails instead of 5 unknowns. Caught by the check written for precisely this,
and fixed by moving the guard onto the wrapper subquery.

**My own test asserted the wrong thing about RLS.** PostgREST returns **no error** for
an UPDATE that RLS filtered out — zero rows, no exception. So "assert no error" passes
against a policy with no restriction on it whatsoever: a test that proves nothing while
appearing to prove something. It now asserts the *effect*, that the label is unchanged.

**My harness leaked into the live database on failure.** `process.exit(1)` inside
`main()` terminated the process before `.finally(cleanup)`, so every failing run
stranded its users, squads and triage rows in the real database — where the gates
above then read them as genuine findings. `process.exitCode` instead. Verified by
deliberately failing a run and confirming it left nothing behind, then purging the
three rows earlier failures had leaked.

**And one from rebuilding the schema** — see below.

## `supabase/schema.sql` was a lie

Worth stating plainly, because the README called it canonical and complete.

It was hand-written, and it had drifted. By Step 26 it was missing migrations **10
through 28** — every table, function, policy and trigger from Phase 4, Phase 5,
Loop C and Loop D. A fresh install from it produced a product with **no feeds, no
notifications, no leaderboards, no recommendation, no AI gates, no attribution and no
referral links**. The counts in the README (24 tables, 73 policies, 9 triggers) were
wrong by more than half.

It is now generated from the live database, which is the only version that can be
correct by construction: **41 tables, 118 policies, 55 functions, 22 triggers, 2
views, RLS on all 41.**

pg_dump output is correct but **not re-runnable** — 131 bare `ADD CONSTRAINT`, 118 bare
`CREATE POLICY` and 68 bare `CREATE INDEX` all fail on a second run.
`scripts/make-schema-idempotent.py` wraps the constraints in `pg_constraint`-guarded DO
blocks, prefixes policies with `DROP POLICY IF EXISTS`, and adds `IF NOT EXISTS` to
indexes. Re-running is how you repair drift, so the claim should be true rather than
aspirational.

**Verified, not asserted:** installed three times in a row against a clean Postgres 17
(roles and `auth` schema stubbed) with **zero errors**, after which all **15 RPCs and
43 tables the app calls** were present. Triggers were confirmed *firing*, not merely
present: a profile insert normalised `'  MixedCase  '` to `mixedcase`, the referral
guard rejected a referrer who was not a squad member, and the token CHECK rejected
`abc-def123456` — the exact base64url shape that caused the Loop D bug.

Three real defects surfaced only because it was installed rather than read:

- the hand-carried `catalog_sync_state` seed omitted a `NOT NULL` column the old table
  had defaulted, so it had been failing silently for several steps
- `conrelid = "public"."t"::regclass` parses as a *column* named `public`, so the
  guard blocks needed single quotes
- the CLI's dump emits `CREATE OR REPLACE TRIGGER`, which a `^CREATE TRIGGER` grep
  misses — I nearly "confirmed" triggers were missing because I searched for the wrong
  string. The dump has 22; the hand-written file had 9.

## Gates

221 unit tests. **200 live-database checks across nine suites**, 27 of them new here.
`tsc`, lint, static RLS audit and production build all clean. The page was driven in
Chromium with zero console errors — including submitting an observation, proposing a
feature as a non-admin, being correctly refused a label, and switching squad scope.

## Honest accounting of what "verified" means here

| Verified | Not verified |
|---|---|
| Every gate's SQL against a live DB and an empty one | Whether any gate has ever returned a *meaningful* verdict — no real squad exists, so the board currently reads test-account data |
| RLS on both tables, as a non-admin, by effect not by error message | The admin path through the UI — no non-admin can be blocked, which is also a failure mode I never exercised the other way |
| 15 RPCs and 43 tables install from `schema.sql` | Migrations 10–31 replayed *on top of* `schema.sql`; README says "schema plus migrations" and I only tested the schema alone |
| 3 of 22 triggers observed firing | The other 19, which exist and are wired identically |
| Zero console errors on one page | Mobile breakpoints, keyboard navigation, screen readers, Core Web Vitals — none measured |
| All AI gates refusing honestly | Any AI feature actually working: 4 of 5 have no provider behind them |
| — | Push delivery against a real FCM endpoint |

## What is left

Two weeks with 3–5 real squads. Not blocked on code — blocked on people.
