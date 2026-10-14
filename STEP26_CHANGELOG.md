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

## Loop D — Squad from referral (`44af1a2`)

### The problem it solves

`squads.invite_code` is one shared 8-character capability per squad. So the link a member forwards to a friend is **byte-identical** to the one another member forwards — "who sent this?" is unanswerable, and a member cannot tell whether their invite did anything. That is the whole reason to invite people.

So the link is now `/squad/join/<code>?ref=<token>`. The split is the design:

| | Role | Consequence if forged |
|---|---|---|
| **`invite_code`** | **Authorises** the join | — |
| **`ref` token** | **Attributes** it | Misattributes credit at worst. Cannot create a membership. |

That asymmetry is why a token is safe to put in a forwardable URL.

### The flow

1. Link opens **logged out**, previews the squad, and **names the inviter**
2. Joining routes to signup **with the token intact**
3. The signup form says what the account is for, and quotes the code
4. Sign-in lands back on the invite, ready to join
5. One click joins, attributes, and sets the squad active

### Opens next to joins

```
3 people have joined through your links (10 opens).
```

The gap between the two is the useful part: twelve opens and no joins means the *pitch* needs work, not the link. Countered server-side with no client UPDATE policy.

### Privacy and abuse

- One inviter per account, **first one wins** — credit cannot be overwritten by walking somebody through a second link
- The table is **private**: readable by the sender and by somebody they actually brought in, nobody else. "Who recruited you" is social data and the link is forwardable
- Only members can mint, enforced by a trigger as well as the route
- Self-referrals ignored

### Three bugs, all mine

**`attribute_join` reused one `uuid` variable to hold a username**, so plpgsql raised `invalid input syntax for type uuid: "some_username_1"` on every call. The route swallowed the RPC error, so attribution silently credited nobody. The route now logs it — that silence is exactly what hid it.

**`my_referral_links` filtered on `auth.uid()`**, which is always NULL for the service-role client the route uses, so every member saw an empty list. Same mistake as the unattributed `ai_calls` rows in Step 25. The user id is now a parameter, granted to `service_role` only.

**The middleware only let five `/api` prefixes past its login redirect.** Every API route added since — including `push/deliver` from Phase 5 and this one — 307'd to `/login` instead of returning its own JSON 401. An allowlist there can only ever be wrong in one direction, so it is gone: `/api/*` is never redirected.

Verified: 36 live-database checks including every abuse case, plus the full flow driven in Chromium — logged-out preview, signup context, sign-in return, join, and the sender's panel.

---

## What is left in the plan

- **Step 27** (two-week real-user test, §58 gates, §76 review, §60 triage) — needs 3–5 real squads. **Blocked on people, not code.** It is the only remaining step.
- **Demo squad realism** (Step 26's cold-start polish): the demo squad exists from Phase 0. The Global segment already returns empty rather than falling back to lifetime totals, which was the honest half of that line.
- **`ai_calls` and `recommendation_log` have no retention policy.** Fine at current volume; worth one before either is indexed.
