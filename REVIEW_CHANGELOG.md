# Full-app review — three shipped bugs found by crawling every route

Asked whether the app was bug free. It was not, and the three worst bugs were
in places nothing was looking.

All three were found by **visiting every route signed in and signed out** and
watching for console errors, page errors and 4xx/5xx responses. Every one had
passed its own tests, typecheck, lint, static audit and build.

| | Symptom | Cause | Tests that missed it |
|---|---|---|---|
| Notebook + Vault | **HTTP 500 for every signed-in user** | Two RLS policies referencing each other | No suite read either table |
| Public profiles | **404 for any handle with a space, `+`, `%` or non-ASCII** | Next passes the segment still percent-encoded | Nothing resolved a real handle |
| Recommendations | **threw on every call, always** | Queried a column that does not exist | No suite of its own |

---

## 1. Notebook and Vault were dead for everyone

`/notebook` and `/vault` returned 500 with:

```
42P01  infinite recursion detected in policy for relation "notebook_notes"
```

The cycle is mutual, and it is in the policies rather than the code:

```
notebook_notes  "Shared notes readable"          -> reads note_shares
notebook_notes  "Owners and editors can update"  -> reads note_shares
note_shares     "Owners manage shares"           -> reads notebook_notes
```

Evaluating one policy enters the other, whose policy re-enters the first, and
Postgres refuses the whole query rather than looping. One note-sharing feature
took down both pages — which are the same feature from the user's point of view.

**Why it survived so long.** The static audit checks that client INSERTs supply
the columns their policy checks. The composer suite covers the editor, not the
list. And nothing anywhere did a plain authenticated `SELECT` on either table.
A total failure stayed invisible because nothing looked at it.

Fixed in `00035` by moving the cross-table lookups into `SECURITY DEFINER`
functions, so the inner reads don't re-enter RLS. Scanned the whole schema for
the same shape: **exactly one cycle existed.**

### Then the fix had two bugs of its own

**It opened an oracle.** `revoke … from public` does not remove the *explicit*
grant Supabase's `ALTER DEFAULT PRIVILEGES` hands `anon` when a function is
created in `public`. So `owns_note(p_note_id, p_user)` and
`note_shared_with(p_note_id, p_user, p_edit)` were callable by anonymous
visitors as a working oracle for "does this account own this note" and "who is
this note shared with". Caught by the suite asserting the negative rather than
trusting the DDL.

**Revoking it broke public notes.** `Public notes readable` and `Shared notes
readable` are in the same policy list, the latter calls the helper, and a
permission error inside any policy expression fails the whole query — so an
anonymous visitor could no longer read a note marked public.

The better answer was to stop taking the user as an argument:

```sql
note_shared_with(p_note_id, p_need_edit)   -- "am I a sharee?"
```

`auth.uid()` comes from the request JWT rather than from any table, so it is
unaffected by the definer rights the function runs with — and there is no longer
an argument to aim at somebody else. `anon` gets `NULL`, matches nothing, and
returns false. Anonymous reads work again and the probe is closed *more* tightly
than before. **`00036`, `00037`.**

`tests/integration/notebook.mjs`, 20 checks: the two reads that used to 500, then
that removing the recursion did not quietly widen access — a read-only recipient
still cannot edit, a bystander still sees nothing, and nobody can smuggle a share
onto a note they do not own.

## 2. Public profiles 404'd for a third of all handles

`/u/prajwal` → 200. `/u/Prem%20Sai` → 404. Both spellings of the second one 404'd.

Two independent bugs stacked:

**Case.** `getPublicProfile` and `getPublicJourney` did
`.eq("username", input.toLowerCase())` while `profiles.username` is stored with
whatever case the member typed. Stored `"Prem Sai"` was unreachable by either
spelling. Fixed with the treatment this codebase had already applied once to
`leetcode_username` and then forgotten for `username`: a stored generated
`username_lower` column with a **unique** index, which also closes the hole where
`Alice` and `alice` were two accounts. A before-write trigger enforces it, because
without one the case-sensitive `unique` constraint would happily accept a
duplicate that breaks the index.

**Encoding.** Next hands a dynamic segment to the page **still percent-encoded**.
Verified against the live app with an isolated route:

```
/dbgseg/abc        -> param "abc"        len 3
/dbgseg/abc%20def  -> param "abc%20def"   len 9   <- not decoded
/dbgseg/abc+def    -> param "abc%2Bdef"   len 9   <- the + was escaped
```

So the page looked up the literal string `"Prem%20Sai"` and found nothing. This
is not only spaces: `%`, `+`, `#`, `&` and every non-ASCII character are all
encoded, so an accented or non-Latin handle was equally unreachable.

`app/patterns/[topic]` already decoded its own segment — so this had been
learned once and never applied again. `lib/pathSegment.ts` now centralises it,
with the three things a bare `decodeURIComponent` gets wrong handled: it *throws*
on a malformed escape (`/u/100%` would be a 500 rather than a 404), it must run
exactly once, and it must refuse to turn an encoded `%2F` into a real slash.

The first draft guarded against a second decode by refusing any value containing
`%25` — which broke every handle with a literal `%`, because `encodeURIComponent`
encodes that to `%25`. The guard was solving a problem a single call does not
have; one decode of `%2520` already yields the literal text `%20`. My own test
caught it. Also centralised the six places that built `/u/${username}` by
interpolation into `profileHref()`.

Verified on the live site: `MixedCase`, `plus+handle`, `dash_handle`, `café`,
`a&b#c` and a literal `%` all resolve, as do `/u/Prem%20Sai` and
`/u/prem%20sai`.

## 3. The recommendation engine had never once worked

`getRecommendation` filtered `list_problems` by `list_slug`. **There is no such
column** — the table is keyed by `list_id`. Postgres answered
`42703 column list_problems.list_slug does not exist` on every call and the
function threw before recommending anything.

Found by watching the signed-in `/practice` page, not by a test — because this
was the one feature in the app with **no suite of its own**. The lesson is about
coverage rather than SQL: the untested feature was the one that had never worked.

Fixed by resolving the sheet through `custom_lists` first, exactly as
`lib/data/sheets.ts` already does. An unknown slug returns `null` rather than
throwing, because it means "no curriculum chosen", not something worth a red
message. `tests/integration/recommend.mjs`, 9 checks, including one that pins the
fact that `list_slug` does not exist so nobody "simplifies" the query back.

---

## A claim I made and got wrong

I said "29 routes, and only 5 have error boundaries — 24 don't." That framed
missing coverage that does not exist. `app/error.tsx` sits at the app root with a
single `app/layout.tsx` and no route groups, so it is a segment boundary wrapping
every route; the four nested `error.tsx` files are route-specific copy, not
additional coverage. **All 29 routes are covered.** I did not manage to get a
deliberate runtime throw to fire in a probe, so this rests on the boundary
structure rather than on an observed catch.

## Two things that look like bugs and are not

**`/u/<username>` returning 404 for a profile that was already deleted** — my
crawler's own cleanup ran before the curl. Not a bug.

**A lone `%` in any URL returns 400.** That is the framework rejecting a
malformed escape before any page code runs, which is the correct HTTP answer for
a malformed request. `decodePathSegment`'s try/catch is defence-in-depth for a `%`
that survives to the page, not a fix for this.

## Also verified, and left alone

`anon` can read all of `user_problem_status`. That looks like a leak and is not:
the policy is named "Allow public read access", and the squad wall and member
list need to read *other* members' progress — an own-row policy would blank the
one place progress is the point. Pinned in the recommend suite, in both
directions: a member can read a squadmate's solve, and nobody can write one.

## Where this leaves the app

- 29 routes crawled signed in and signed out: **no console errors, no page errors,
  no failing requests.** Only the correct 404s.
- `notebook_notes` and `note_shares` readable again; sharing verified end to end
  including the read-only/edit distinction and the admin-only share writes.
- 238 unit tests, **229 live-database checks across eleven suites** (notebook,
  recommend and the triage/validation fixes are all new).
- `schema.sql` regenerated: 0 errors installed three times into a clean
  Postgres 17, all 15 RPCs and 43 tables present, triggers observed firing,
  120 policies and 30 triggers.
- `scripts/make-schema-idempotent.py` now counts only the forms that *need*
  guarding, so re-running it on its own output is a no-op and only under-guarding
  is treated as a defect.
