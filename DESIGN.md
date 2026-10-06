---
name: "Mahayuddh"
description: "Social DSA practice arena in an Apple Music dark world — pitch black, frosted glass, rose accent."
colors:
  surface-base: "#000000"
  surface-sidebar: "#121212"
  surface-muted: "#1c1c1e"
  surface-raised: "#2c2c2e"
  surface-strong: "#3a3a3c"
  text-primary: "#ffffff"
  text-secondary: "#8e8e93"
  text-accent: "#fa586a"
  accent-strong: "#d60017"
  difficulty-easy: "#30d158"
  difficulty-medium: "#ff9f0a"
  difficulty-hard: "#ff453a"
  accent-hover: "#e02340"
  info-blue: "#0a84ff"
  glow-rose: "rgba(255, 55, 95, 0.2)"
  glow-blue: "rgba(100, 210, 255, 0.2)"
  og-gradient-start: "#0a0a0a"
  og-gradient-end: "#1c0f12"
  violet: "#bf5af2"
  warning-yellow: "#ffd60a"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading-section:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.3
  wordmark:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    fontSize: "18px"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  mono-metric:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
rounded:
  card: "14px"
  container: "22px"
  modal: "24px"
  pill: "9999px"
  input: "10px"
  sheet: "16px"
  overlay: "20px"
spacing:
  section-gap: "40px"
  card-gap: "16px"
  content-gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "#e02340"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card-bento:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.card}"
    padding: "24px"
  input-field:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.input}"
    padding: "10px 14px"
  chip-difficulty:
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# DESIGN.md — Mahayuddh (as built)

> Generated from code 2026-10-05. Normative tokens live in `app/globals.css`
> `:root`; this file records them plus the patterns agents must follow.
> The project's fuller spec is `design.md` v2.0.0.

## 1. World

Apple Music web app transposed to DSA practice: pure-black canvas, frosted
glass sidebar + header + dock, category bento tiles in rich gradients
(crimson, sunset, royal, purple, emerald, amber, violet, rose), Top Picks hero
cards, persistent Now Solving bottom bar. Dark only — the use scene (late-night
solving) picks it, not the category.

## 2. Color discipline

- Rose `#fa586a` is for text, borders, icons, and glows — never as a fill
  behind white label text (3.15:1, fails). Filled CTAs use `--accent-strong`
  `#d60017` (5.42:1), hover `#e02340` (4.68:1).
- Body text floor is white at 50% on near-black (~5:1). Dimmer steps exist
  only for icons, bullets, and decorative rules — never sentences.
- Difficulty colors are semantic and never restyled: green/amber/red.

## 3. Type discipline

- No kicker/eyebrow above a heading, anywhere. The heading carries its weight.
- Card category labels (`TODAY'S BATTLE`, `SQUAD STREAK`) are card metadata,
  not kickers, and stay.
- Buttons and chips never break mid-phrase: labels are `whitespace-nowrap`
  inside `shrink-0` controls.
- Numbers that are measurements use tabular mono; numerals in tables ship
  tabular.

## 4. Touch and focus

- 44px minimum touch target on touch layouts; desktop keeps natural size via
  `min-h-11 md:min-h-0` (or equivalent) so density survives.
- One global focus ring: 2px `#fa586a` at 2px offset, defined once in
  `globals.css`. Never `focus:outline-none` without a replacement. Form
  controls carry it explicitly (`input:focus-visible`) because of a Chrome UA
  rule. Focusable transitions use `transition-colors`, never `transition-all`
  (which animates the ring itself).

## 5. Motion

- One authored moment per surface, exponential ease-out, from an
  already-visible default. Hover lifts are `scale-[1.01–1.02]` + opacity
  shifts, 200ms. No scattered entrances, no `animate-pulse` as decoration.

## 6. States and honesty

- Every async surface states loading, error (with retry), and empty — and the
  empty copy names what fills it, never back-filled content.
- Numbers shown are measured: no invented durations, no 100% bars on
  constants, reason counts shown rather than hidden.
- Errors name the problem and the recovery, never provider strings; identical
  copy for wrong-password vs unknown-account (no enumeration oracle).

## 7. Shell contract

- Sidebar footer avatar is the single identity/dossier trigger. No identity
  chips in page headers.
- Header carries the global search (design.md §2); the sidebar keeps its own
  trigger. One search action, two doors.
- Dock stacks above the mobile tab bar via `--dock-bottom`; page bottom
  padding clears both. Overlays never permanently occlude content.
- Glass reads as texture, not competing text: dock 0.94, header 0.90 alpha.
