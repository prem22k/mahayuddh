---
version: alpha
name: Mahayuddh
description: >-
  Precision dark interface for squads who practice DSA together. Obsidian
  canvas, layered hairline surfaces, one warm gold for action and streaks,
  emerald for verified proof, indigo for patterns. Calm by default,
  celebratory at the moments that matter, and built around collector-grade
  Pass artifacts people want to screenshot.

colors:
  # Surfaces: four layers, each one step lighter
  canvas: "#0A0B0E"
  surface: "#141518"
  surface-raised: "#191A1E"
  surface-overlay: "#202127"
  well: "#0E0F12"

  # Lines
  hairline: "rgba(255, 255, 255, 0.08)"
  hairline-strong: "rgba(255, 255, 255, 0.14)"
  edge-highlight: "rgba(255, 255, 255, 0.04)"

  # Text
  text-primary: "#EDEDEF"
  text-secondary: "#A1A3AB"
  text-tertiary: "#84868F"
  text-disabled: "#55575E"
  on-primary: "#1A1406"

  # Key colors (the roles Stitch builds its palette from)
  primary: "#F5B83D"
  secondary: "#A1A3AB"
  tertiary: "#8B91F7"
  neutral: "#141518"

  # Heat: primary action, streak flame, live timer
  primary-hover: "#FFC95E"
  primary-pressed: "#E0A32B"
  primary-tint: "#2A251C"

  # Proof: verified solves only
  verified: "#3DDC97"
  verified-tint: "#182925"

  # Knowledge: patterns, primers, approaches
  pattern: "#8B91F7"
  pattern-tint: "#222433"

  # Broken / destructive / error
  error: "#F26D78"
  error-tint: "#2A1E22"

  # Utility
  focus-ring: "rgba(237, 237, 239, 0.72)"
  scrim: "rgba(5, 6, 8, 0.72)"

  # Landing stage only: the warm lamp. Stored in CSS as channel triplets
  # (--light / --face) so each use sets its own alpha. Never a fill or text.
  stage-light: "#FFE8C6"
  stage-face: "#FFCE92"

typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.03em
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.025em
  display-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.015em
  numeral-xl:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.03em
    fontFeature: "'tnum' 1"
  numeral-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
  heading:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 600
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 17px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0px
  body:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  label:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0px
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.01em
  mono-display:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1, 'zero' 1"
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: 500
    lineHeight: 28px
    letterSpacing: 0px
    fontFeature: "'tnum' 1, 'zero' 1"
  mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
    fontFeature: "'tnum' 1, 'zero' 1"
  code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0px
  mono-caption:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.06em
  # Landing stage only: statements
  statement-hero:
    fontFamily: Space Grotesk
    fontSize: "clamp(2.75rem, 0.6rem + 6.6vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: -0.038em
  statement-xl:
    fontFamily: Space Grotesk
    fontSize: "clamp(2.6rem, 0.9rem + 5.4vw, 5.75rem)"
    fontWeight: 600
    lineHeight: 0.97
    letterSpacing: -0.036em
  statement-lg:
    fontFamily: Space Grotesk
    fontSize: "clamp(2.4rem, 1rem + 4.2vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: -0.032em
  statement-numeral:
    fontFamily: JetBrains Mono
    fontSize: 0.9em
    fontWeight: 500
    letterSpacing: -0.04em
    fontFeature: "'tnum' 1, 'zero' 1"

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 40px
  3xl: 48px
  4xl: 64px
  5xl: 80px
  gutter-mobile: 16px
  gutter-desktop: 40px
  sidebar-width: 248px
  header-height: 56px
  content-max: 1120px
  reading-max: 680px
  # Landing stage only
  stage-max: 1200px
  beat-padding: "clamp(4.5rem, 10vw, 8.5rem)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 0 24px
  button-primary-disabled:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-disabled}"
  button-secondary:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-secondary-hover:
    backgroundColor: "#272830"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 12px
  button-ghost-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
  button-danger:
    backgroundColor: "{colors.error-tint}"
    textColor: "{colors.error}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-hover:
    backgroundColor: "{colors.surface-raised}"
  pass:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 32px
  pass-stub:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.mono-caption}"
    padding: 24px
  badge-verified:
    backgroundColor: "{colors.verified-tint}"
    textColor: "{colors.verified}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0 8px
  badge-self-reported:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0 8px
  badge-difficulty:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0 8px
  chip-pattern:
    backgroundColor: "{colors.pattern-tint}"
    textColor: "{colors.pattern}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    height: 24px
    padding: 0 10px
  chip-filter:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 0 12px
  chip-filter-selected:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
  streak-chip:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 0 10px
  nav-item:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 0 12px
  nav-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
  tab:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    height: 40px
    padding: 0 4px
  tab-active:
    textColor: "{colors.text-primary}"
  segmented:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 4px
  segmented-option-active:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  solve-dock:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    height: 56px
    padding: 0 12px
  solve-capsule:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    height: 48px
    padding: 0 8px
  tab-bar:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-tertiary}"
    typography: "{typography.caption}"
    height: 64px
  avatar-sm:
    rounded: "{rounded.full}"
    size: 24px
  avatar-md:
    rounded: "{rounded.full}"
    size: 32px
  avatar-lg:
    rounded: "{rounded.full}"
    size: 48px
  avatar-xl:
    rounded: "{rounded.full}"
    size: 80px
  kbd:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.mono-caption}"
    rounded: "{rounded.xs}"
    height: 20px
    padding: 0 6px
  modal:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 24px
  popover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 8px
  tooltip:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 6px 8px
  toast:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  code-block:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text-primary}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: 16px
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.hairline-strong}"
    height: 1px
  card-edge-highlight:
    backgroundColor: "{colors.edge-highlight}"
    height: 1px
  focus-indicator:
    backgroundColor: "{colors.focus-ring}"
    width: 2px
  modal-scrim:
    backgroundColor: "{colors.scrim}"
  # Landing stage only (light, mask and shading live in .impeccable/design.json)
  pass-stage:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 36px
  pass-stage-stub:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.mono-caption}"
    width: 30%
    padding: 24px
  lit-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 24px
  example-tag:
    backgroundColor: transparent
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.xs}"
    height: 20px
    padding: 0 6px
  # Documented exception: the guide's identity mark is gold app-wide
  sarathi-avatar:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: 36px
---

# Mahayuddh Design System

Version 4. This file replaces every earlier design spec for Mahayuddh,
including the Apple Music–derived system (rose accent, frosted glass, bento
gradients, 13px type scale). None of those tokens or rules carry forward.
Extended 2026-11-03 with the landing stage, a register scoped to the public
landing; nothing else changed.

## Overview

**What this is.** Mahayuddh is where a squad of 2–7 developers practices DSA
together: one daily problem, timed solves, verified proof, shared streaks,
1v1 challenges, and side-by-side approaches. Think "Strava for code": effort
is celebrated with friends, never surveilled.

**The scene.** A developer opens Mahayuddh on a laptop after work or late at
night, in a dim room, with LeetCode in the next tab. Later they check it on
their phone on the commute to see whether the squad streak survived. Dark is
the right answer for that light, not a genre choice.

**The feel.** Precision software in the lineage of Linear, Raycast, and
Vercel: an obsidian canvas, surfaces stacked in thin hairline layers, a
calm type rhythm, and exactly one warm color that means "go". The interface
stays quiet so the moments that matter (a verified solve, a streak that
held, a challenge from a friend) can be loud.

**Signature move: the Pass.** The four artifacts people share (Today's
Battle Pass, the Verified Proof card, the Squad Streak card, and the 1v1
Challenge Pass) are built like physical event passes: a main body and a
perforated stub, with notches cut into the edges at the tear line. The
stub holds the serial details in small mono caps: problem number, date,
squad, verification. Nothing else in the product uses this shape. When
people see a perforated card on X or LinkedIn, it should be recognizably a
Mahayuddh Pass.

**Principles every screen follows.**

1. **One focal point.** Each screen has exactly one element that is
   unmistakably the reason it exists, usually a Pass, a problem, or a single
   primary action. Everything else is quieter in size, weight, and color.
2. **Curiosity before completeness.** Show the gap, then let people close
   it: "3 of your squad solved this · fastest 14:22 by @priya" beats a table
   of times. Code from other people is hidden behind a Reveal control until
   the viewer has made their own attempt or chooses to look.
3. **Open loops stay visible.** An unbroken streak, an unanswered challenge,
   and a weekly goal at 7/10 are always one glance away (the sidebar user
   card, the Arena rail, the mobile top bar).
4. **Progressive disclosure.** The top level shows a title, a difficulty,
   who's involved, and one action. Runtime details, history, and edge cases
   expand on demand through tabs, disclosures, and hover previews.
5. **No dead ends.** Every finished action offers the next one. A solve
   leads to "Explain your approach", "Challenge someone to beat 14:22", and
   "Compare with your squad". An empty state always says what to do.
6. **Honest data.** Show only what was measured. Verified and self-reported
   solves look different. A recommendation with one reason says "1 reason".
   Empty means empty. Nothing is back-filled.

**Voice.** Plain, warm, and specific, the way a good teammate talks.
Sentence case everywhere. Name actions with verbs ("Start battle",
"Explain your approach", "Challenge Rahul"). Numbers carry units ("14m 22s",
"7 of 10 solved"). Product nouns are Arena, Battle, Revenge (re-attempting a
problem you failed), Squad, Streak, Proof, Approach, Pattern, Primer,
Notebook, and Sheet. Never use jargon written to sound impressive; the
banned list is under Do's and Don'ts.

**The landing stage (scoped register).** The public landing is the one
place the product is put on a stage. Warm light falls on its surfaces, its
pieces sit in 3D depth, the camera moves as the visitor scrolls, and the
motion is big. The app avoids all of this, and every other rule in this file
still binds every other screen. The stage lives in one landing-only
stylesheet and never leaks into globals. Each section below ends with a
"Landing stage" block that describes it as built.

**The Stage Is Scoped Rule.** Light pools, lit faces, perspective,
scroll-linked transforms, and the statement sizes belong to the public
landing only. If a signed-in screen seems to need one of them, the screen
is wrong.

## Colors

The palette is restrained on purpose. Neutrals carry about 90% of every
screen, and each of the three hues has one job.

**Surfaces (darkest to lightest).**

| Token | Use |
|---|---|
| `canvas` #0A0B0E | Page background, the space between things |
| `well` #0E0F12 | Inset regions: inputs, code blocks, segmented-control tracks |
| `surface` #141518 | Cards, the sidebar, the Pass body, the mobile tab bar |
| `surface-raised` #191A1E | Hovered cards, popovers, the solve dock, modals, the Pass stub |
| `surface-overlay` #202127 | Selected rows, active segments, secondary buttons, tooltips |

**Lines.** Every card and floating surface has a 1px `hairline` border.
`hairline-strong` is for floating layers (dock, modal, popover) and for
input borders on focus. `edge-highlight` is a 1px inner top edge on cards
that gives them a little lift without a shadow.

**Text.** `text-primary` for titles and the content people came to read;
`text-secondary` for supporting text and inactive navigation;
`text-tertiary` for timestamps and metadata. `text-disabled` is only for
disabled controls and never carries information. All informational text
passes WCAG AA on every surface it sits on.

**The three hues.**

- **Gold, `primary`: heat and action.** The primary button, the streak
  flame, and the live-timer dot while a battle runs. **At most one gold
  filled button per view.** Gold never appears as decoration, as a heading
  color, or on more than one competing element. If two things on a screen
  are gold, one of them is wrong. The one standing exception is Sarathi's
  mark (see The Identity Mark Exception below).
- **Emerald, `verified`: proof.** Only for solves that LeetCode sync has
  verified: the Verified badge, the Proof card seal, and solved-cell fills
  in sheets. A self-reported solve uses a neutral outline badge with
  "Self-reported", never emerald.
- **Indigo, `pattern`: knowledge.** Pattern chips (Sliding Window, Two
  Pointers, DP), primer links, approach write-ups, and the Stuck ladder's
  hint tiers.
- **Rose, `error`.** Errors, destructive actions, and a streak that
  broke. Used sparingly; a broken streak is information, not a scolding.

**Difficulty is not a color.** Easy, Medium, and Hard use a neutral badge
with a three-pip meter (one, two, or three filled pips) next to the word.
This keeps gold and emerald unambiguous. Pips are `text-secondary`, and
empty pips are `hairline-strong`.

**Tints and lines.** Each hue has a solid `-tint` (the hue at about 10%
over `surface`) for badge and chip fills. Borders in a hue use the hue at
30% alpha. Never place a hue's text on another hue's tint.

**Key-color mapping.** `primary` is the gold, `tertiary` is the pattern
indigo, `secondary` is a neutral steel for secondary emphasis, and
`neutral` is the card surface. `verified` stays its own role and is never
used as a general "secondary" color.

**The Identity Mark Exception.** Sarathi's avatar, the chariot-wheel mark
in `primary` on `primary-tint` inside a 1px gold ring at 30% (36px, or 28px
small), renders in gold app-wide. It is the guide's identity mark, not an
action, and it is the only gold that is not the primary action, the live
timer, or the streak flame. It never becomes a filled gold control, it
doesn't count against the one-gold-button rule, and it doesn't license gold
for any other identity (people, squads, badges, labels).

**Landing stage: the lamp.** Two warm tokens, stored in CSS as channel
triplets (`--light` 255 232 198, `--face` 255 206 146) so every use sets its
own alpha. Neither is gold, and neither ever fills text, a control, or a
border on its own.

- **`stage-light`: the light in the air.** The stage pool behind every
  piece (a radial at 17% in the core, 6% at half radius, then transparent),
  the hero pool (24%, then 8.5%), the 1px top-edge highlight on a Pass (a
  line 72% wide, 60% at its centre and fading to nothing at both ends), and
  the hero sheen (8.5%).
- **`stage-face`: the same lamp as it reads on a dark face**, deeper and
  warmer. The Pass body face (a radial from above-left, 17% then 5.5%), the
  Pass stub face (11%), the lit-card face (15% then 4.5%), and the lit top
  border (28% on a Pass, 26% on a lit card). Face alphas scale with the
  piece's entrance progress, so a piece is unlit until it rises into place.
- Every lit face also carries a bottom shade: black from transparent at 55%
  down to 22% on the Pass body and 20% on the stub and lit cards.

**The One Lamp Rule.** The stage has one light source, overhead and a little
to the left. Every pool, face, and edge is lit from it. Nothing glows from
within, and no hue (gold, emerald, indigo) is ever used as light.

## Typography

Three faces, each with one role.

- **Space Grotesk (display).** Page titles, problem titles on Passes, hero
  headlines, and big counted numerals (streak days, 7/10, squad totals).
  Only at 24px and up. Its quirky geometry is the brand's voice; at small
  sizes it gets loud, so it stays large.
- **Geist (interface).** Everything people read or operate: navigation,
  body, labels, buttons, form fields, and section headings up to 18px.
- **JetBrains Mono (measurement and code).** Timers, solve times,
  durations, problem numbers (No. 518), kbd hints, code, and the Pass
  stub's serial lines. Always tabular and slashed-zero. Mono is never used
  to make plain text look "technical".

**Scale.**

| Token | Face | Size / line | Use |
|---|---|---|---|
| display-xl | Space Grotesk 600 | 64 / 64 | Landing hero only |
| display-lg | Space Grotesk 600 | 44 / 46 | Public page titles, problem title on a shared Pass |
| display-md | Space Grotesk 600 | 32 / 36 | In-app page titles, problem title on the Arena Pass |
| title | Space Grotesk 600 | 24 / 29 | Card titles, modal titles |
| numeral-xl | Space Grotesk 600 | 56 / 56 | Streak count, a hero count |
| numeral-md | Space Grotesk 600 | 28 / 31 | Inline stats (solved, rank) |
| heading | Geist 600 | 18 / 26 | Section headings inside a page |
| body-lg | Geist 400 | 17 / 28 | Long-form reading: primers, approaches, recaps |
| body | Geist 400 | 15 / 24 | Default body and descriptions |
| label | Geist 500 | 14 / 20 | Buttons, navigation, tabs, form labels, table text |
| caption | Geist 500 | 12 / 16 | Timestamps, metadata, badge text |
| mono-display | JetBrains Mono 500 | 48 / 48 | Solve time on a Pass, the full-size active timer |
| mono-lg | JetBrains Mono 500 | 20 / 28 | Solve dock timer, leaderboard times |
| mono | JetBrains Mono 400 | 14 / 20 | Inline durations, problem numbers |
| code | JetBrains Mono 400 | 14 / 22 | Code blocks |
| mono-caption | JetBrains Mono 500 | 12 / 16, +0.06em, uppercase | Pass stub serials and kbd keys only |

**Rules.**

- Weights are 400, 500, and 600. No 700+, no light weights, no italics in UI.
- Sentence case for everything, including buttons and headings. The only
  uppercase text is `mono-caption` inside a Pass stub or a kbd key.
- No eyebrow or kicker text above headings. A heading stands on its own;
  context goes in a line below it or in the breadcrumb.
- Reading surfaces cap their measure at `reading-max` (680px, about 70
  characters).
- Times use the format `14:22` (mm:ss) in mono when they are the hero, and
  `14m 22s` in running text. Hours appear only when present: `1:02:15`.
- Numbers that change (timers, counts, ranks) are tabular so they don't
  jitter.

**Landing stage: statements.** The landing speaks in short sentences set
very large: Space Grotesk 600 with balanced wrapping, in three sizes that
replace `display-xl` on the stage. Outside the stage, the scale above
stands.

| Token | Size / line, tracking | Use |
|---|---|---|
| statement-hero | clamp(2.75rem, 0.6rem + 6.6vw, 6rem) / 0.95, -0.038em | The hero headline and the closing line |
| statement-xl | clamp(2.6rem, 0.9rem + 5.4vw, 5.75rem) / 0.97, -0.036em | The default beat statement |
| statement-lg | clamp(2.4rem, 1rem + 4.2vw, 4.75rem) / 0.98, -0.032em | A statement that shares its row with an aside or a piece |

- Statements hold a narrow measure (10–16ch), so a sentence breaks into two
  or three heavy lines.
- **Mono numerals inside sentences.** A measured value in a statement is set
  in `statement-numeral`: JetBrains Mono 500 at 0.9em, -0.04em, tabular and
  slashed-zero ("Priya solved it in 14:22."). Only measurements get this,
  never a word.
- **Words light up as they cross the reading line.** Each word's opacity
  runs from 12% to 100% in reading order, driven by the statement's
  progress `--p` (0 when its top is at 92% of the viewport, 1 at 42%). At
  rest, without JavaScript, and under reduced motion, `--p` is 1 and every
  word is lit.
- The aside under a statement is Geist 400 at 17/28 (18/30 from 768px) in
  `text-secondary`, capped at 34rem.

## Layout

**Grid.** Everything sits on an 8px grid, with 4px only for icon-to-label
gaps and tight inline clusters. Card padding is 24px on desktop and 16px on
mobile. Gaps between sections are 32–40px on desktop and 24–32px on mobile.
Give something more space above it than below it.

**Breakpoints.** Mobile is 390px (designed at iPhone width, works from
360px). Tablet is 768px. Desktop is 1280px and wider; the layout also holds
at 1024px with the sidebar collapsed to icons.

**Desktop shell (1280px+).**

- **Sidebar**: 248px, `surface`, with a hairline right edge. From top to
  bottom: the wordmark; a search button showing "Search" and ⌘K; the
  primary nav (Arena, Practice, Squad, Feed, Challenges, Leaderboard,
  Notebook); a quiet "Sheets" group listing pinned roadmaps; and pinned to
  the bottom, the user card (avatar, name, @handle, squad name, streak
  chip).
- **Header**: 56px, transparent over `canvas`. Breadcrumb on the left; on
  the right, the LeetCode sync status, the notification bell, and at most
  one contextual action for the page.
- **Content**: centered in the remaining width, max 1120px, with a 40px
  gutter. Reading pages narrow to 680px.
- **Solve dock**: floats 16px above the bottom edge, centered on the
  content column, max 720px wide, 56px tall. It's there only while a battle
  is active, or as a single quiet line when idle on practice pages. Content
  gets 96px of bottom padding so the dock never covers the last row.

**Mobile shell (390px).**

- **Top bar**: 56px with the wordmark (or the page title on inner pages),
  the streak chip, and search. A menu button opens the slide-in drawer for
  everything outside the four tabs.
- **Tab bar**: 64px plus the safe area, four tabs (Arena, Practice, Squad,
  Feed), icon over label.
- **Solve capsule**: a 48px pill floating 12px above the tab bar while a
  battle runs.
- Touch targets are at least 44px. Multi-column layouts stack in priority
  order, and the focal element always comes first.

**Composition pattern: focal plus rail.** Most app screens use one wide
focal column (about 2/3) and one quiet rail (about 1/3) on desktop. On
mobile the rail stacks below the focal content. The focal column leads with
the screen's single hero element. The rail holds open loops (challenges
waiting, weekly goal, streak status) as compact rows, never as competing
cards of equal weight.

**Density.** Lists show 5–7 items before a "Show all" link. No dense data
grids on general screens. The Roadmap Matrix and Leaderboard are the only
tabular screens, and even they use 48px rows with generous padding.

**Landing stage rhythm.** One `stage-max` container (1200px) holds the nav,
the hero, every beat, the close, and the footer, with the shell gutters
(16px, and 40px from 768px). Each beat is a section with `beat-padding`
(clamp(4.5rem, 10vw, 8.5rem)) above and below; the short "what it isn't"
beat tightens to clamp(4rem, 9vw, 7rem), and the close opens to
clamp(6rem, 15vw, 12rem).

- Inside a beat, a 12-column grid from 1024px with 40–48px column gaps.
  Statement and piece alternate sides from beat to beat (aside 4 / piece 8,
  piece 7 / aside 4, piece 6 / statement 6), and one beat centres on a
  900px statement over an 820px piece. Below 1024px everything stacks,
  statement first.
- The nav is 64px and fixed: transparent at the top, then `canvas` with a
  hairline bottom edge once the page has scrolled 12px.
- The hero opens 112px from the top (144px from 768px). From 1024px its
  Pass sits in the right 8 columns, dropped 20vh below the headline.

## Elevation & Depth

Depth comes from stacked surface tones and hairlines, not from shadows.

| Layer | Treatment | Examples |
|---|---|---|
| 0 · Ground | `canvas` | Page background |
| 1 · Resting | `surface` + 1px `hairline` + 1px inner `edge-highlight` top | Cards, sidebar, Pass body |
| 2 · Lifted | `surface-raised` + 1px `hairline-strong` + shadow `0 8px 24px -8px rgba(0,0,0,0.5)` | Hovered interactive cards, popovers, dropdowns, the solve dock |
| 3 · Overlay | `surface-raised` + 1px `hairline-strong` + shadow `0 24px 64px -16px rgba(0,0,0,0.7)` over a `scrim` | Modals, the ⌘K palette, the mobile drawer |

- Resting cards have no drop shadow. A card lifts to layer 2 only on hover
  and only if it's interactive.
- No glows, halos, or neon edges. The single exception is the Pass's
  verified seal, which gets a soft 12px emerald bloom at 20% for the moment
  it lands, and then the bloom fades.
- The scrim behind modals may use a light backdrop blur (8px) to keep focus.
  Blur is never used on cards or as decoration.

**Landing stage: light and depth.** The flat rules above hold everywhere
except the landing stage, where depth comes from light and perspective
instead of tone alone. The pools are light falling on the floor, not glows
on an element, so the no-glow rule and the seal's bloom exception stand.

- **Pools.** Every staged piece has a pool of `stage-light` behind it: a
  radial at a 1.5 ratio, up to 1250px wide, centred 70% above the piece,
  whose opacity follows the piece's progress. The hero pool is wider (165%,
  1.45 ratio, 78% above) and comes up once the hero Pass has landed.
- **Contact shadow** (`radial-gradient(closest-side, rgb(0 0 0 / 0.7),
  transparent)`, 68px tall, inset 6% from each side, 34px below the piece).
  It sets the piece on the stage. The close has a pool but no piece, so no
  shadow.
- **Layers.** Statements and asides sit on a far layer that drifts 56px
  across a beat's pass through the viewport. Pieces sit on a near layer
  that travels 40px the other way.
- **Perspective.** 1400px on piece entrances, 1600px on the turns, 1700px on
  the beat crane.

**The Floor Rule.** On the stage, every piece sits on a contact shadow under
its own pool of light. Nothing floats.

## Shapes

**Radii.** `xs` 4px is for kbd keys. `sm` 6px is for badges. `md` 8px is
for buttons, inputs, and nav items. `lg` 12px is for cards and popovers.
`xl` 16px is for Passes, modals, and the solve dock. `full` is for avatars,
chips, and the mobile capsule. Nested elements use a radius one step
smaller than their container.

**The Pass shape.** A rounded `xl` rectangle split into a body and a stub
by a perforation:

- **Landscape (desktop and share images)**: the stub is the right ~28%.
  The perforation is a vertical dashed hairline (4px dash, 4px gap). Two
  16px semicircular notches are cut into the top and bottom edges where the
  perforation meets them, showing the canvas through.
- **Portrait (mobile)**: the stub is the bottom ~30%, with a horizontal
  perforation and notches cut into the left and right edges.
- **The body** holds the hero content: title, the hero number, the social
  line, and the action.
- **The stub** sits on `surface-raised` and holds 3–4 stacked serial lines
  in `mono-caption`, such as `NO. 518`, `12 OCT 2026`, `SQUAD KSHATRIYA`,
  and a status line or verified seal.
- **Share ratios**: 1200×630 for link previews (X, LinkedIn) and 1080×1350
  for portrait image shares.

**Icons.** Lucide, 1.5px stroke, 16px inline with text and 20px in
navigation, always `currentColor`. The streak flame is the Lucide flame
filled with `primary` when the streak is alive today, outlined in `primary`
when today isn't done yet, and outlined in `text-tertiary` when the streak
is broken. No emoji as icons.

**Avatars.** Always circles. The fallback is initials in `text-secondary`
on `surface-overlay`. In a stack, avatars overlap by 8px with a 2px
`canvas` ring, showing three at most, then a "+2" counter in the same
circle style.

**The Pass on the landing stage.** The same shape, cut for real. Instead of
canvas-coloured circles painted on the edges, the notches are cut through
with a CSS mask (two radial masks, 20px across with a 1px soft edge, at
both ends of the perforation), so the stage light and the canvas show
through them.

- **Landscape:** the stub is 30% wide behind a 1px dashed
  `hairline-strong` perforation.
- **Portrait (below 768px):** the Pass stacks and the stub takes a fixed
  height (116px, or 120px on the hero Pass) behind a horizontal
  perforation, with the notches cut into the left and right edges.
- The corner stays `xl` (16px). Lit cards (the code and Sarathi pieces)
  also take `xl` on the stage, one step above app cards, so they sit with
  the Passes.

## Components

Each component has one job. The token blocks above define the default
dimensions; this section defines anatomy, states, and behavior.

### Actions

- **Primary button** (gold). The one action the screen exists for: "Start
  battle", "Accept challenge", "Join squad". 40px tall, or 48px for the hero
  action on a Pass or landing page. Hover lightens, press darkens, and
  loading swaps the label for a spinner while keeping the width. Disabled
  is `surface-overlay` with `text-disabled`, never a faded gold.
- **Secondary button.** Sits next to a primary or stands alone on screens
  with no gold action.
- **Ghost button.** Tertiary actions, toolbar actions, and "Show all".
- **Danger button.** Only inside confirmation dialogs ("Leave squad").
- **Icon button.** 36px square (44px on mobile), ghost styling, and a
  tooltip naming the action.

### Inputs

- **Text input / textarea.** A `well` fill, 1px `hairline` border, and a
  `hairline-strong` border plus a 2px `focus-ring` on focus. The label sits
  above in `label`. Helper or error text sits below in `caption`, with
  errors in `error` and a fix in plain words ("Handle not found on
  LeetCode. Check the spelling or skip it for now.").
- **Segmented control.** 2–4 options for switching views of the same data
  (This week / All time).
- **Tabs.** Underline tabs: a 2px `text-primary` underline marks the active
  tab. For 3–6 sibling sections of one page.
- **Filter chips.** A row of `chip-filter` items for narrowing a list.
  Selected is `surface-overlay` with `text-primary`.
- **Search / ⌘K.** A wide trigger in the sidebar and header that opens the
  command palette (see Overlays).

### Status and identity

- **Difficulty badge.** The word plus a 3-pip meter, neutral (see Colors).
- **Verification badge.** `badge-verified`: a check icon plus "Verified".
  `badge-self-reported`: a 1px `hairline-strong` outline plus
  "Self-reported". Every solve shows one of the two.
- **Pattern chip.** Indigo, rounded full, with the pattern name ("Sliding
  window"). It links to the Pattern Hub.
- **Streak chip.** A gold flame plus a count ("14"), with a tooltip "14-day
  squad streak". In its "today not done" state the flame is outlined.
- **Avatar stack with a social line.** Up to three avatars plus one
  sentence: "Priya, Rahul and 1 more solved this · fastest 14:22". This is
  the curiosity hook and should sit right next to the primary action.
- **Presence-free.** No green "online" dots and no "typing…" indicators.
  The product is async by design.

### The four Passes (signature)

All four share the Pass shape. Body content is described top to bottom.

1. **Today's Battle Pass** (Arena hero). Body: problem title
   (`display-md`); a meta row with the difficulty badge, pattern chip, and
   `No. 518` in mono; the social line with avatar stack and fastest squad
   time; then the primary "Start battle" plus a ghost "Open on LeetCode".
   Stub: `NO. 518`, the date, the squad name, and "3 of 5 solved". Once you
   solve it, the same Pass becomes your Proof card in place, and the next
   actions appear beneath it.
2. **Verified Proof card.** Body: problem title, then the solve time in
   `mono-display` as the hero, then the previous attempt struck through
   with the improvement ("23:40 → 15:06 · 8m 34s faster"), then the
   verification badge. Stub: @handle, date, `NO. 518`, and the emerald
   verified seal: a 48px circle outline with a check and the word
   "Verified". If the solve is self-reported, there is no seal; the stub
   says "Self-reported" plainly.
3. **Squad Streak card.** Body: the flame plus the count in `numeral-xl`
   ("14 days"), the squad name, and a 7-day row of small dots per member
   showing who kept it alive each day (filled is solved, hollow is
   missed). Stub: the squad name, "Since 28 Sep", and the member count.
   A squad streak is the run of consecutive days on which every active
   member logged at least one solve. It is never a sum of personal
   streaks.
4. **1v1 Challenge Pass.** Body: "Rahul challenged you" in `title`, the
   problem title, the time to beat in `mono-display` ("38:11"), and
   Rahul's one-line note in quotes. Primary "Accept challenge" and ghost
   "Not now". Stub: `FROM @RAHUL`, `TO @PREM`, the date, and the status
   (Open / Beaten / Expired).

The Pass is the only place where the composition gets dramatic: the
biggest type on the screen, the most negative space, the most contrast.
Everything around it steps down.

### Lists and rows

- **Problem row.** 56px. Status glyph (empty circle, half circle for
  attempted, emerald check for verified, neutral check for self-reported),
  title, difficulty badge, pattern chip, and on the right, the squad social
  hint ("2 solved") and best time in mono. Hover lifts to `surface-raised`
  and reveals a "Start" ghost button.
- **Leaderboard row.** 56px. Rank in `numeral-md` (top three are
  `text-primary`, the rest `text-secondary`; no medals and no gold), avatar,
  name and @handle, the metric in mono, and a change indicator (↑2 / ↓1 /
  —). The current user's row is pinned with a `surface-overlay` fill.
- **Feed item.** Avatar, a one-line sentence ("Priya solved Coin Change II
  in 14:22"), a relative timestamp, and an optional embedded mini-Pass or
  approach excerpt. When it applies, a quiet "Proven useful" note appears
  when someone acted on the post (solved, copied, or answered). Actions:
  Open, Compare, Reply (on discussions), and a ⋯ menu (Report, Block,
  Delete). No like counts and no infinite scroll; pages load in 20s with
  "Show older".
- **Matrix cell.** A 32px rounded-`sm` square. Empty is `well` with a
  hairline, attempted is `surface-overlay`, self-reported is a
  `text-secondary` outline, and verified is a `verified-tint` fill with an
  emerald check. Hovering shows a popover with the title, who in the squad
  solved it, and the times.

### Disclosure

- **Accordion.** For edge cases, constraints, and runtime breakdowns. A
  chevron rotates 90°, and the content fades and slides in 8px.
- **Reveal code.** Code from other people starts collapsed behind a `well`
  panel showing the language, line count, and solve time, with a secondary
  "Reveal code" button. If you haven't attempted the problem, the panel
  also says "You haven't attempted this yet." Revealing is always the
  user's choice.
- **Hover preview.** On desktop, hovering an avatar or @handle for 400ms
  shows a popover with the person's streak, solves this week, and a "View
  profile" link.

### Shell components

- **Sidebar user card.** Avatar, name, @handle, squad name, and the streak
  chip. It's an open loop: when today's battle isn't done, the chip shows
  the outlined flame and the line reads "Solve today to keep 14".
- **Solve dock (desktop).** Left: a pulsing gold dot and the elapsed time
  in `mono-lg`. Center: the problem title and difficulty badge. Right:
  Notes (ghost), Pause (icon), and the primary "Submit solve". When idle it
  collapses to one line: "No battle running" plus a "Pick a problem" ghost
  link. It's hidden on reading pages.
- **Solve capsule (mobile).** A gold dot, the time in mono, a truncated
  title, and a 36px check button to submit. Tapping it expands a bottom
  sheet with the full dock.
- **Notification bell.** A small dot when there's something unread (in
  `text-primary`, since gold is reserved). The popover groups items as
  Challenges (new, beaten), Squad (goals, weekly recaps), Practice (revenge
  due), and Contests, with "Mark all read" and a push-alerts toggle.

### Overlays

- **Modal.** For tasks that need protected focus: send a challenge, post to
  the feed, confirm leaving a squad. 480–560px wide on desktop, a bottom
  sheet on mobile. It has a title, an optional one-line description, a
  body, and a footer with the primary action on the right. Esc and the
  scrim close it, unless there's unsaved input.
- **Command palette (⌘K).** 640px wide, anchored 20% from the top. Input
  at the top; results grouped (Problems, Patterns & primers, People,
  Actions); the active row is a `surface-overlay` fill with a ⏎ kbd hint
  at its right end; a footer with ↑↓ ⏎ esc hints in kbd keys.
- **Toast.** Bottom center on desktop (above the dock), top on mobile. One
  line plus an optional action ("Undo"). Auto-dismisses after 5s.

### Empty, loading, and error states

- **Empty** states get a one-line heading and one line saying what will
  appear here and how to make it appear, plus one action. For example:
  "No approaches yet" / "When someone in your squad explains their
  solution, it shows up here." / "Explain yours". No illustrations of sad
  robots.
- **Loading** uses skeletons in `surface-raised` that match the final
  layout and shimmer once every 1.6s. A spinner is only for actions under
  2s.
- **Errors** say what happened and what to do, in human words, with a
  retry. Never show provider error strings.

### Motion

- **One authored moment: the stamp.** When a solve verifies, the Proof
  card's seal drops in (scale 1.12 → 1, opacity 0 → 1, 280ms, ease-out
  `cubic-bezier(0.16, 1, 0.3, 1)`), the emerald bloom fades over 600ms,
  and the improvement line counts up. It happens once per verification.
  Everything else stays subdued.
- **Micro-interactions.** 120–160ms ease-out for hovers and presses, 200ms
  for disclosures, and 240ms for modals and sheets (fade plus an 8px rise).
- **Live timer.** Ticks once per second with tabular digits. No pulsing
  text, only the 2s gold dot pulse.
- **Reduced motion.** Respect `prefers-reduced-motion`: swap every motion
  for an opacity fade of 120ms or less.

### Landing stage

- **Statement, aside, piece.** Every beat is one statement, one aside, and
  one working piece of the product at stage scale: Today's Battle Pass with
  a real timer, the Proof card, the code reveal, Sarathi's nudges, the
  Challenge Pass, and the Squad Streak card.
- **Example tag.** Every demo person and squad carries an "Example" tag:
  Geist 500 at 11px in `text-tertiary`, a 1px `hairline` border, `xs`
  corners, 20px tall, top-right of the piece. The page makes no claims
  about real users, counts, or results.
- **Gold on the landing.** One gold filled button per view, as everywhere.
  "Start a squad" in the hero and at the close is the gold action (48px
  tall, 24px padding, a 15px label, and a trailing arrow). The solve dock
  carries the demo battle's gold Submit only while the hero Pass is off
  screen (less than 25% visible) and the closing section is off screen
  (less than 20% visible), so it never shares a view with either gold
  "Start a squad". Buttons inside the pieces (Try it, Pause, Submit solve, Reveal
  code, Accept challenge) are secondary: 44px on phones and 40px from
  768px, with a `hairline-strong` border. The nav's "Start a squad" is
  secondary too.
- **Solve dock and capsule.** The app's dock and capsule carry the demo
  clock down the page: a 48px pill on phones (max 420px) and a 56px `xl`
  bar from 768px (max 720px). After a submit it confirms "Logged 14:22 ·
  self-reported" with a "See it" link for a few seconds, then leaves.

### Landing stage motion

Every move uses the stamp's ease-out, `cubic-bezier(0.16, 1, 0.3, 1)`.
Scroll-linked moves read custom properties written by one passive scroll
listener; nothing re-renders on scroll.

- **The opening.** The two headline lines rise from 112% below their masks
  (1100ms, at 60ms and 170ms). The subline, the actions, and the free line
  fade up 14px (900ms, at 380, 480 and 560ms). The hero Pass enters from
  72px below, tilted back 18° (1400ms, from 300ms). The house lights come
  up over it (2200ms, from 650ms). One sheen crosses the Pass once (2400ms,
  from 1100ms). Nothing loops.
- **Hero drift and dolly (`--q`).** `--q` runs 0 → 1 over the first 70% of a
  viewport of scrolling. The headline lifts 110px and dims to 25%; the Pass
  rises 36px and grows 3.5% from its top edge, toward the camera.
- **Per-beat entrances (`--p`).** A piece's `--p` runs 0 → 1 as its top
  travels from 102% to 58% of the viewport. There are four entrances, and
  neighbouring beats never share one: rise (up 72px, untilting 12° from the
  bottom edge), turn right (in 64px from the right and 24px from below,
  turning 18° on the right edge), turn left (its mirror), and dolly (up
  40px, scale 0.88 → 1). The pool and the face light follow `--p`; the
  piece itself runs from 15% to full opacity.
- **The per-beat crane (`--b`).** Each beat reports where its centre sits
  (0 entering at the bottom, 0.5 centred, 1 leaving at the top). Its
  content tilts up to ±8° in rotateX: seen slightly from above on the way
  in, square to the lens at the centre, tipping toward the viewer on the
  way out. It shrinks by up to 4.5% away from the centre. The far and near
  layers drift against it (see Elevation & Depth).
- **Small authored motions inside pieces.** Hidden code sits under a 7px
  blur at 50% opacity and clears over 600ms when the visitor chooses to
  reveal it; the blur is the spoiler itself, never decoration. The streak
  count rolls up (520ms), today's streak dot pops (0.35 → 1.2 → 1, 460ms),
  and the dock rises in 14px (280ms).
- **The stamp is still the one authored moment.** The Proof card's seal
  waits off screen and stamps the first time the card is 70% visible, with
  the same stamp and bloom as the app. Everything else on the stage is
  camera, not a moment.
- **Reduced motion.** No scroll progress registers, so every property keeps
  its resting value and every piece renders final: lit, square to the lens,
  in place. The opening animations are off, the sheen is removed, the far
  and near drift and the crane are flattened, and the reveal becomes a
  120ms opacity change. The seal shows already set. Server render and
  no-JavaScript visitors see the same final frame.

**The Final-Frame Rule.** Every landing motion travels toward a state that
is already correct at rest. Scroll properties default to their final value,
so motion only ever starts somewhere else.

### Browser details

- Text selection uses `primary-tint` with `text-primary`.
- The caret is `primary`.
- Scrollbars are thin (8px) with `surface-overlay` thumbs and no track.
- Focus is always visible as a 2px `focus-ring` outline with a 2px offset.
- Links in body copy are `text-primary` with a 1px `hairline-strong`
  underline at a 3px offset, and the underline becomes `text-primary` on
  hover.

## Do's and Don'ts

**Do**

- Give every screen one focal point and let everything else step down.
- Keep gold to the primary action and the streak. Keep emerald for
  verified proof and indigo for patterns.
- Put the social line ("3 of your squad solved this · fastest 14:22")
  next to the primary action. That's where curiosity turns into action.
- Show the next step after every completion: explain, challenge, compare.
- Distinguish verified from self-reported every time a solve appears.
- Write empty states that say what goes here and how to fill it.
- Use real-looking data in mockups: real LeetCode problem names and
  numbers, plausible mm:ss times, Indian and international first names
  (Priya, Rahul, Arjun, Meera, Sam, Lena), and squads of 3–7.
- Design mobile as the same product: same components, stacked by
  priority, with 44px targets.
- On the landing, tag every demo person and squad "Example".
- On the landing, light every piece from the one overhead lamp and set it
  on its contact shadow.

**Don't**

- Don't use more than one gold filled button per view, gold headings,
  gradient text, or gold "glow" effects.
- Don't add eyebrows, kickers, or tracked all-caps labels above headings.
- Don't make page structure out of a grid of equal icon-plus-title cards.
  Don't nest cards inside cards.
- Don't use the hero-metric template (huge number, tiny label, row of stat
  tiles) on general screens. Big numbers belong in Passes.
- Don't use dense crypto-style data grids, sparkline walls, progress rings,
  or radar charts as decoration.
- Don't add glassmorphism, neon edges, colored left-border callouts, or
  hard offset shadows.
- Don't use emoji as icons, or mono type as a costume.
- Don't use fake gamification: no XP, coins, points wagers, loot, levels,
  or casino-style celebrations. No countdown timers built to manufacture
  urgency. The daily pick says "New pick at midnight", not a ticking clock.
- Don't add presence theater: no "online now" dots, no fake activity.
- Don't carry the landing stage into the app: no light pools, lit faces,
  perspective, scroll-linked transforms, or statement sizes on signed-in
  screens.
- Don't light anything with a hue. The lamp is the only light.
- **Don't use these words or anything like them:** protocol, telemetry,
  tactical, vector (outside its DSA meaning), intel, operative, mission
  control, command center, wager, reputation points, algorithmic
  prescription, neural, quantum, synergy, unlock your potential, supercharge,
  level up, dominate, crush it, elite. Also no version-number theater like
  "Arena v2.4".
