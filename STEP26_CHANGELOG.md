# Step 26 Changelog — Growth loops + cold-start polish

**Branch:** `phase-0-2-gap-closure`, unpushed. Commit `c9b1b55`.
**Bible refs:** §47 (forking/copying), §38 (shareable artifacts), §56 (Loop C), §22 (no single score).

---

## The bug that came first

**Every real `/u/[username]` page was returning 500.**

Step 22's profile reads select `approaches.fork_count`. That column has never existed — the migration that added fork counters covered `primers` and `shared_resources`, and nobody noticed `approaches` was missing.

It survived because the only profile page ever exercised was a **404 for a username that does not exist**, which short-circuits before the query runs. Everything above the fold was fine; the page had never actually loaded.

Fixed in `20261003000024` and verified in Chromium against a real profile: the five §22 dimensions render, "Often teaches" lists the pattern, and verified solves read *"2 with LeetCode evidence"* rather than a bare number.

---

## Loop C — Knowledge attribution (§47, §56)

Step 13 built the fork. Nothing closed the loop, because an author could not see that their writing changed anybody's behaviour.

### What a completion is, and is not

| | Meaning | Source |
|---|---|---|
| **Fork** | Somebody agreed the writing was worth taking into their own notebook | `notebook_notes.fork_of` |
| **Completion** | They then **solved the problem**, within 30 days | `content_impact.solved_at` |

The two are never collapsed. A copy is agreement; a solve is behaviour. Counting them as one number would let a popularity metric stand in for impact.

**The 30-day window is load-bearing.** Without it, a developer who copied a primer in March and solved the problem in December would count forever, and the author would be told their primer caused it. Causal-sounding claims need bounded claims.

### Implementation notes

- `notebook_notes.fork_of` is a bare uuid that can point at an approach, a primer **or** a vault item. `fork_of_type` disambiguates it. Existing rows are backfilled by matching each table; **unmatched rows are left null rather than guessed at**.
- Fork counters are maintained by a **trigger** on all three kinds, including decrements on delete, so no client write can drift them.
- Vault resources have **no completion branch** — `shared_resources` has no problem link, so there is nothing for a copier to go and solve. Counting copies as impact would inflate the number with forks, which is what the fork count is already for.
- `my_content_impact()` returns only objects somebody actually copied, so the panel cannot list a wall of zeroes.

### The headline rules

- `completions > 0` → *"Helped 3 developers solve"*
- `forks > 0, completions == 0` → *"3 copies, none solved the problem yet"*
- Neither is ever dressed up as the other.

### Verified against the live database (18 checks)

Including the four that make the causal claim honest:

- a solve **before** the copy is not a completion
- a solve **56 days** after the copy is not a completion
- solving an **unrelated** problem is not a completion
- **deleting** the copy decrements the counter and removes the chain row

### A fixture bug worth recording

The "solve before the copy" test failed on the first run. The view was right and the fixture was wrong: the copier had already solved that problem for primer 1, so a *later* solve legitimately fell inside primer 2's window. The fix was a dedicated problem for that case, not a weaker assertion.

---

## Season Result — the artifact that was never built

Step 20 lists five shareable artifacts. Four shipped in Phase 3; **Season Result was the one that never got built**, so a completed season — the one thing a squad finishes *together* — had nothing to share.

- `app/squad/[id]/seasons/[seasonId]` + OG card
- Public, with the middleware allowlist matching that path precisely so the season **list** stays authenticated
- Aggregate only: named members, counts, patterns, best improvement. No scratchpads, no approaches, no per-battle detail — the numbers are what the squad did together, and anything finer would make it a dossier
- Its headline is generated the way the recap's is, and will say *"nobody challenged anybody — the loop was only half running"* when that is what happened

---

## `share_signup` — the missing half of Loop B

§56 names both events. `share_clicked` existed; the conversion did not, so sharing was only measurable as far as the click. Now fires at signup whenever a `?via=` source was stored and consumed.

---

## Verification

```bash
npx tsc --noEmit                # clean
npm run lint                    # no warnings or errors
npm run test:smoke              # 200/200
npm run test:static             # RLS insert audit
npm run build                   # 32/32 static pages

npm run test:integration:impact  # 18/18  live database
```

Browser, Chromium against a production build: a real profile page renders, the
Notebook Impact tab explains its empty state without pretending there is impact,
and the §22 dimensions and "Often teaches" both appear.

---

## What is left in the plan

- **Step 27** (two-week real-user test, §58 gates, §76 review, §60 triage) — needs 3–5 real squads. **Blocked on people, not code.** It is the only remaining step.
- **Loop D** squad-from-referral: `shareSource` records the source of a visit, so the data exists, but no flow yet attributes a *squad creation* to a share. Half-built.
- **Demo squad realism** (Step 26's cold-start polish): the demo squad exists from Phase 0; this step's line is about making it realistic enough that an empty Global feed does not pretend success. Partially true already — the Global segment returns empty rather than falling back to lifetime totals.
