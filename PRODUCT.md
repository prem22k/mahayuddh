# PRODUCT.md — Mahayuddh

> Source: `Mahayuddh_Product_Operating_System_v2.md` (Product Bible v2, 2026-09-30),
> `MAHAYUDDH_EXECUTION_PLAN.md`, `design.md` v2.0.0, plus user confirmation
> 2026-10-05 on accessibility posture, success metric, and brand latitude.
> Facts inferred without a source are marked [inferred].

## Users

- Primary: developers preparing for technical interviews, practicing in small
  squads of 2–7 people they know (college crews, coworkers, friends).
- Situation: solo grinding on LeetCode is lonely and stalls; they want
  accountability and to learn how their people think.
- Job: practice DSA consistently with their people, prove what they can do,
  challenge each other, get better together.

## Product

- A social practice layer around LeetCode — not a judge, not a roadmap, not a
  social network. LeetCode owns judging; NeetCode-style sheets own curation;
  Mahayuddh owns the loop around actual practice:
  **Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return.**
- Core loops: the Battle Loop (daily pick → timed solve → proof → revision),
  the Squad Loop (formation → shared goals → challenges → streaks), the
  Knowledge Loop (approaches, primers, notebook), the Community Loop (feed,
  suggestions, leaderboard segments).
- Positioning: proof over vanity (no fake gates, no invented stats), async by
  default, private first with explicit sharing, use LeetCode rather than
  becoming it.

## Success

- North-star behavior: squads forming and sticking — **squad retention** is
  the metric design optimizes for (confirmed 2026-10-05). Battles/week and
  explanations written are supporting signals, not the target.

## Constraints (durable)

- Never gate the product on LeetCode: every surface works without a connected
  handle; sync is enhancement, not entry.
- Never invent data: durations, reasons, and standings shown must be measured.
  A one-reason recommendation must not look like a strong one.
- No game-UI slop: streaks, flames, and ranks are information, not decoration.
- Every important action has a next action (solve → explain → challenge).
- Honest empty states: nothing is back-filled; unfilled surfaces say so.

## Terminology

- Arena (home), Battle (timed solve), Revenge (re-attempt of a failed problem),
  Squad, Sheets/roadmaps, Patterns/topics, Primers, Notebook/vault,
  Suggestions/challenges, Streak flame, Contest rating.

## Platform

- Web (Next.js app). Mobile web is the same product at <768px with a drawer,
  4-tab bar, and 44px touch floor — not a separate design language.

## Accessibility

- WCAG 2.2 AA is an **aspiration, fixed opportunistically** (confirmed
  2026-10-05) — not a release gate. New work should clear AA; grandfathered
  failures are tech debt, not blockers. [The Oct 2026 frontend passes
  incidentally brought 11 audited routes to zero AA failures.]

## Brand

- Visual world: Apple Music web app (pitch-black surfaces, frosted glass,
  bento gradients, rose `#fa586a` accent). Pinned.
- Wordmark, "Developer Arena" descriptor, taglines, and brand copy **may
  evolve with design passes** (confirmed 2026-10-05).
- Voice: plain, honest, no internal jargon in user-facing copy (no "Bible §N",
  no provider error strings, no fake presence).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth).
  [inferred from repo; delegated — never explicitly chosen in interview.]
