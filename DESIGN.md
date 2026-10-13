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
---

# Mahayuddh Design System

Version 4. This file replaces every earlier design spec for Mahayuddh,
including the Apple Music–derived system (rose accent, frosted glass, bento
gradients, 13px type scale). None of those tokens or rules carry forward.

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
  are gold, one of them is wrong.
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
- **Don't use these words or anything like them:** protocol, telemetry,
  tactical, vector (outside its DSA meaning), intel, operative, mission
  control, command center, wager, reputation points, algorithmic
  prescription, neural, quantum, synergy, unlock your potential, supercharge,
  level up, dominate, crush it, elite. Also no version-number theater like
  "Arena v2.4".
