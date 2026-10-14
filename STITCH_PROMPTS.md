# Stitch Prompts — Mahayuddh

The master prompt catalog for generating every Mahayuddh screen in Google
Stitch. There are 34 screens and views, each specified for desktop (1440px)
and mobile (390px).

- **Design system:** [`DESIGN.md`](./DESIGN.md) (v4). It owns every color,
  typeface, radius, spacing value, and component style. Load it into the
  Stitch project as the design system before generating anything.
- **Stitch project:** `10293929484782160896` (the existing Mahayuddh
  project). Re-apply DESIGN.md v4 before generating, because the project's
  old design-system asset predates it.
- **Product truth:** [`PRODUCT.md`](./PRODUCT.md). Every data field in
  these prompts exists in the app today or is flagged under **Build notes**
  as a gap.

---

## 0. How these prompts work

### The Zoom-Out → Zoom-In standard

Every prompt moves from the widest frame to the smallest detail, in this
fixed order:

| Field | Answers |
|---|---|
| **CONTEXT** | What is this screen, and where is the person in their day? |
| **GOAL** | What should they do or understand within a few seconds? What is the one focal point? |
| **VIEWPORT** | Desktop and mobile frames, and which shell state is showing. |
| **LAYOUT ZONES** | The regions of the screen, top to bottom and left to right, with their proportions. |
| **COMPONENT HIERARCHY** | What sits in each zone, nested, using the design system's component names. |
| **DATA** | Field-by-field realistic content. This is the content to render, not placeholders. |
| **STATES** | Which state to render by default, and the other states that exist. |
| **INTERACTIONS** | What each control does, and the next step after each completion. |

### Rules for every prompt

1. **No styling in prompts.** No hex values, font names, pixel borders, or
   CSS. Prompts name design-system roles and components instead: *primary
   button*, *Pass*, *verified badge*, *pattern chip*, *streak chip*,
   *problem row*, *solve dock*. DESIGN.md decides how those look.
2. **One focal point.** GOAL names it. Everything else is described as
   secondary or quiet.
3. **Real content.** Use the shared cast and data below so screens agree
   with each other. Never use lorem ipsum, "User 1", or `$XX`.
4. **Plain words.** No eyebrows or kicker labels above headings. Use the
   product nouns from DESIGN.md (Arena, Battle, Revenge, Squad, Streak,
   Proof, Approach, Pattern, Primer, Notebook, Sheet). None of the banned
   jargon listed in DESIGN.md.
5. **Every completion has a next step.** No screen ends in a dead end.

### The standard opening line

Every prompt starts with this sentence, so Stitch always binds to the
design system:

> Apply the Mahayuddh design system from DESIGN.md for every color, type
> style, spacing value, radius, and component; introduce no new colors or
> fonts.

### Shell blocks

In-app screens include one of these blocks, with the active item and dock
state filled in.

**Desktop shell.** Standard Mahayuddh app shell. Sidebar: wordmark
"Mahayuddh"; a Search button with a ⌘K hint; nav Arena · Practice · Squad
· Feed · Challenges (count 1) · Leaderboard · Notebook, with **{active}**
active; a quiet "Sheets" group listing NeetCode 150, Blind 75, Striver SDE;
the user card pinned at the bottom (Prem Sai · @prem · Kshatriya · streak
chip 23). Header: breadcrumb on the left; on the right "Synced 4m ago"
LeetCode status and the notification bell with an unread dot. Solve dock:
**{state}**.

**Mobile shell.** Top bar with a menu button, the page title, streak chip
23, and a search button. Bottom tab bar: Arena · Practice · Squad · Feed,
with **{tab}** active. Solve capsule: **{state}**.

### Shared cast and data

Use these everywhere so every screen agrees with every other.

- **You:** Prem Sai, @prem. Personal streak 23 days. LeetCode connected,
  synced 4 minutes ago. Solved 68 Easy · 31 Medium · 6 Hard. Contest
  rating 1,584.
- **Squad Kshatriya** (5 members, invite code KQ7X2P9M): Prem Sai
  (@prem, admin), Priya Nair (@priya), Rahul Verma (@rahul), Arjun Mehta
  (@arjun), Sneha Iyer (@sneha). Squad streak 14 days, since 28 Sep.
  Today: Priya, Rahul, and Sneha have solved; Prem and Arjun haven't yet.
- **Today:** Monday, 12 October 2026.
- **Today's battle:** No. 518 Coin Change II · Medium · Dynamic
  programming. Reasons: "Unsolved in NeetCode 150" and "Matches your squad
  goal pattern" (2 reasons). Squad: 3 of 5 solved, fastest 14:22 by @priya
  (Rahul 19:47, Sneha 22:05).
- **Open challenge:** Rahul challenged you on No. 127 Word Ladder · Hard.
  Beat 38:11. Note: "Took me two tries. Think hard about the visited set."
  Due Sunday 18 Oct.
- **Squad goal:** "Sweep the sliding-window set": 7 of 10 solved ·
  Sliding window · 5 days left · 3 of 5 members contributed.
- **Proof example:** No. 3 Longest Substring Without Repeating
  Characters · Medium · Sliding window. Solved in 15:06, previous best
  23:40 (8m 34s faster). Verified on LeetCode. Attempts 2 · Revisits 1 ·
  Challenged 3 · Friends who solved it 2.
- **Review queue:** No. 42 Trapping Rain Water (failed at 41:06, 3 days
  ago: revenge available); No. 76 Minimum Window Substring (solved 24
  days ago: fading); No. 207 Course Schedule (Graphs is a weak pattern).
- **Season:** "Season 01 — Graph War", 14 Sep – 11 Oct 2026. Objective: 40
  graph problems as a squad.
- **Other people:** Kabir Shah (@kabir), Lena Park (@lena), and Sam
  Okafor (@sam), from other squads, for the global views.

### Recommended generation order

Generate one screen at a time: desktop first, then mobile. Review each
against DESIGN.md before moving on. The first screens establish the
shell and the four Passes, and everything after reuses them.

1. **03 Arena**: desktop, then mobile. Establishes the shell, the Today's
   Battle Pass, and the rail.
2. **05 Problem Workspace**: the battle result card and tabs.
3. **23 Battle Proof**: the Verified Proof Pass at share scale.
4. **24 Challenge Deep-Link**: the 1v1 Challenge Pass.
5. **13 Squad Hub**: the Squad Streak Pass.
6. **S1 Desktop Shell, S2 Mobile Shell, S3 ⌘K**.
7. **04, 06, 07, 08, 09**: the rest of the practice loop.
8. **10, 11, 12, 14, 15, 16, 17**: social and squad.
9. **18, 19, 20, 21**: knowledge.
10. **22, 25**: public pages.
11. **29, 30, 31**: overlays.
12. **26, 27, 28**: utility.
13. **01 Landing, 02 Login**: last, so the landing page can feature the
    finished Passes.

The tracker at the end of this file records progress.

---

## 1. Shell & Chrome

### S1 · Desktop Application Shell

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The persistent frame around every signed-in Mahayuddh page on a laptop or desktop. Developers keep it open in one tab next to LeetCode during practice sessions, often in the evening.

GOAL
Know where everything is at a glance, and see your open loops (a running battle, a waiting challenge, a streak that needs today's solve) without hunting. The focal point is the active battle in the solve dock.

VIEWPORT
Desktop 1440 × 1024. Show the shell around a simple Practice page so the chrome is the subject.

LAYOUT ZONES
1. Left sidebar, full height, fixed.
2. Header bar across the top of the content area.
3. Content area: a centered column with generous side gutters.
4. Solve dock floating near the bottom edge, centered on the content column.

COMPONENT HIERARCHY
Sidebar
  - Wordmark "Mahayuddh"
  - Search button: magnifier icon, "Search", ⌘K kbd hint on the right
  - Primary nav (nav items with icons): Arena, Practice (active), Squad, Feed, Challenges with count 1, Leaderboard, Notebook
  - Quiet group heading "Sheets" with three nav items: NeetCode 150, Blind 75, Striver SDE
  - User card pinned at the bottom: avatar, "Prem Sai", "@prem · Kshatriya", streak chip "23" with an outlined flame and the line "Solve today to keep 23"
Header
  - Breadcrumb: "Practice"
  - Right cluster: LeetCode sync status "Synced 4m ago" (ghost button with a refresh icon), notification bell with an unread dot
Content area
  - Page title "Practice", with one supporting line below it
  - Three problem rows as placeholder content
Solve dock (active)
  - Left: live dot, elapsed time "18:42" in the mono timer style
  - Center: "Coin Change II", difficulty badge Medium, "No. 518"
  - Right: Notes (ghost), Pause (icon button), "Stuck?" (ghost), primary button "Submit solve"

DATA
active_nav: Practice · challenges_waiting: 1 · user: Prem Sai / @prem / Kshatriya · personal_streak: 23, today not done · sync: synced 4m ago · active_battle: No. 518 Coin Change II, Medium, elapsed 18:42

STATES
Default: battle running (as above).
Idle dock: one quiet line, "No battle running", with a "Pick a problem" ghost link. The dock is hidden on reading pages.
Collapsed sidebar at 1024–1279px: icons only, with tooltips.
Sync in progress: the sync button shows a spinner and "Syncing…".
LeetCode not connected: the status reads "Connect LeetCode" and stays a ghost button, never a blocker.

INTERACTIONS
⌘K or the Search button opens the command palette (S3). The bell opens the notifications popover, grouped as Challenges, Squad, Practice, and Contests. Clicking the user card opens the Warrior Dossier (31) for yourself. "Submit solve" ends the battle and checks LeetCode for an accepted submission. "Stuck?" opens the Stuck ladder popover (09). Notes opens a scratchpad popover above the dock: "Saved on this device for this problem".
```

**Build notes.** Nav changes from today: Home becomes "Arena", and
Profile moves into the user card. The dock gains a "Submit solve" label
(today it says "Mark Solved") and keeps Failed and Abandon inside an
overflow menu.

### S2 · Mobile Companion Shell

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The mobile frame around every signed-in page. People check it on the commute or in bed: is the squad streak alive, did someone challenge me, is my battle timer still running.

GOAL
Thumb-reach access to the four most-used areas and to the running battle. This frame shows the slide-in drawer open, so the focal point is the drawer's navigation.

VIEWPORT
Mobile 390 × 844. The drawer is open over the dimmed Arena; the tab bar and solve capsule are visible beneath the scrim.

LAYOUT ZONES
1. Top bar.
2. Page content (Arena, dimmed under the scrim).
3. Slide-in drawer from the left, about 85% of the width.
4. Solve capsule floating just above the tab bar.
5. Bottom tab bar with safe-area padding.

COMPONENT HIERARCHY
Top bar
  - Menu button, title "Arena", streak chip "23" (outlined flame: today not done), search button
Drawer (overlay layer)
  - Profile block: avatar, "Prem Sai", "@prem", squad switcher row "Kshatriya · 5 members" with a chevron
  - Nav list: Challenges (count 1), Leaderboard, Notebook, Primers, Stuck requests, Sheets (expandable: NeetCode 150, Blind 75, Striver SDE)
  - Footer rows: "LeetCode · synced 4m ago", Settings, Sign out
Solve capsule (active)
  - Live dot, "18:42" in the mono timer style, "Coin Change II" truncated, a round check button to submit
Tab bar
  - Arena (active), Practice, Squad, Feed, icon over label

DATA
title: Arena · streak: 23 (today not done) · squad: Kshatriya, 5 members · challenges_waiting: 1 · active_battle: Coin Change II 18:42

STATES
Default: drawer open, battle running.
Drawer closed: the Arena shows normally.
No active battle: the capsule is hidden entirely.
Capsule tapped: a bottom sheet expands with the full dock (timer, title, difficulty, Notes, Pause, Stuck?, primary "Submit solve").

INTERACTIONS
Swipe from the left edge or tap the menu to open the drawer; tap the scrim or swipe left to close it. Tabs switch top-level areas and keep each tab's scroll position. Every touch target is at least 44 high.
```

**Build notes.** The tabs change from today's Arena · Ranks · Topics ·
Inbox to Arena · Practice · Squad · Feed. Today's Topics tab points to
`/patterns`, which has no index page and returns a 404. Challenges and
Leaderboard move into the drawer and the Arena rail.

### S3 · Global Search Modal (⌘K)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The command palette, opened with ⌘K from anywhere. Power users jump to a problem, pattern, person, or action without touching the mouse.

GOAL
Type three letters, press Enter, and you're there. The focal point is the highlighted top result.

VIEWPORT
Desktop 1440 × 1024: the palette is centered horizontally, about 20% from the top, over the scrimmed Arena. Mobile 390 × 844: a full-height sheet with the input pinned at the top and the keyboard up.

LAYOUT ZONES
1. Search input row.
2. Grouped results list.
3. Footer hint row.

COMPONENT HIERARCHY
Input row: magnifier icon, query text "sli", an "esc" kbd key on the right
Results
  - Group "Problems"
    - Row (active, highlighted): status glyph verified check, "Longest Substring Without Repeating Characters", "No. 3" mono, difficulty badge Medium, pattern chip "Sliding window", ⏎ kbd at the right end
    - Row: empty status glyph, "Sliding Window Maximum", "No. 239", Hard, chip "Sliding window"
    - Row: half-filled status glyph (attempted), "Minimum Window Substring", "No. 76", Hard, chip "Sliding window"
  - Group "Patterns & primers"
    - Row: book icon, "Sliding window in 8 minutes", "Primer · 6 starter problems"
    - Row: grid icon, "Sliding window", "Pattern hub · 14 problems you've solved"
  - Group "People"
    - Row: avatar, "Sneha Iyer", "@sneha · Kshatriya · 9-day streak"
  - Group "Actions"
    - Row: play icon, "Start a battle on today's problem"
Footer: kbd hints "↑↓ to move", "⏎ to open", "esc to close"

DATA
query: "sli" · problems: [3, 239, 76] with status verified / none / attempted · primer: Sliding window in 8 minutes · person: Sneha Iyer (matches "S…" fuzzy) · action: start today's battle

STATES
Default: results for "sli".
Empty query: "Recent" (3 recently opened problems) and "Jump to" (Arena, Squad, Notebook).
No results: "Nothing matches 'xyz'. Search covers problems, patterns, primers, and people in your squads."
Loading: skeleton rows, only when indexing takes longer than 300ms.

INTERACTIONS
↑/↓ move the highlight. Enter opens the result: problems go to the workspace (05), patterns to the hub (08), people to the profile (22), and actions run. ⌘Enter on a problem starts a battle immediately. Esc or a scrim click closes the palette.
```

**Build notes.** Search covers only problems today. Patterns, primers,
people, and actions need indexing.

---

## 2. Entry & Auth

### 01 · Landing Page (`/welcome`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The public landing page. A developer arrives from a friend's shared Proof card on X or LinkedIn, or from an invite. They're tired of grinding LeetCode alone and wonder whether this is different. This is a persuasion page told in six stages.

GOAL
Within one viewport, understand "practice DSA with your people, with proof", and start. The focal point is the hero, built as a giant Mahayuddh Pass: the page's signature object is the offer itself.

VIEWPORT
Desktop 1440 wide, full page, with six stages scrolling. Mobile 390 wide, the same six stages stacked, with the hero Pass in its portrait form.

LAYOUT ZONES
Top bar: wordmark "Mahayuddh" on the left; "Sign in" ghost button and "Join with a code" secondary button on the right.
Stage 1, the admission pass (first viewport): one oversized Pass centered in the viewport, taking about 80% of the content width. Its body is the hero: the headline sits where a problem title would, followed by the subline, then the primary action. Its perforated stub holds serial lines. No separate hero copy outside the Pass.
Stage 2, the problem: a single typographic statement of three short lines, left-aligned, with lots of space around it.
Stage 3, a day in the squad: a vertical timeline of six moments, each with a small real component beside it.
Stage 4, things you'll want to screenshot: the four Passes laid out as a loose fanned collection, slightly overlapping and rotated by no more than 3 degrees, each with a one-line caption.
Stage 5, what it isn't: a short list of five plain statements.
Stage 6, the close: a final, smaller Pass repeating the action.
Footer: quiet links (Primers, Sign in, Privacy) and the wordmark.

COMPONENT HIERARCHY
Stage 1 Pass (landscape on desktop)
  Body
    - Headline (largest display style): "Practice DSA with your people."
    - Subline: "One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it."
    - Actions: primary button large "Start solo"; secondary button "Explore the demo squad"
    - Small line: "Free. Works without a LeetCode account."
  Stub (mono serial lines)
    - "ADMIT 2–7"
    - "SQUAD · YOURS"
    - "DAILY · 1 PROBLEM"
    - "PROOF · VERIFIED"
Stage 2: heading "Solo grinding stalls quietly." Three lines: "Streaks break and nobody notices." / "A 150-problem sheet feels like a wall." / "Global ranks tell you nothing about your friends."
Stage 3: heading "One day in a squad." Timeline moments:
  1. "07:40 · You open the Arena": a mini problem row for today's problem (Coin Change II, Medium, Dynamic programming)
  2. "13:10 · Priya solves it in 14:22": a mini verified badge with the time
  3. "13:12 · Rahul challenges you": a mini challenge row "Beat 19:47"
  4. "21:30 · You solve it in 16:05": the time with "Verified"
  5. "21:34 · You explain your approach in two sentences": a mini approach excerpt
  6. "21:40 · You compare with your squad": a two-column mini comparison
Stage 4: heading "Proof you'll actually want to share." Four Passes: Today's Battle Pass, Verified Proof card (15:06, 23:40 → 15:06), Squad Streak card (14 days), Challenge Pass (Beat 38:11). Each is captioned and marked "Example".
Stage 5: heading "What it isn't." Lines: "No XP, coins, or levels." / "No wagers." / "No countdowns built to rush you." / "No AI that hands you the code." / "No LeetCode account required."
Stage 6: a smaller Pass. Body: "Your first battle takes two minutes." with primary button "Start solo" and ghost button "Join with a code". Stub: "NO. 001", "YOUR FIRST BATTLE".

DATA
All Pass contents use the shared example data (Coin Change II, Priya 14:22, squad streak 14, Rahul's Word Ladder challenge at 38:11) and are visibly labeled "Example".

STATES
Single static state. Hover on each fanned Pass in stage 4 straightens and lifts it.

INTERACTIONS
"Start solo" goes to sign-up (02) and then the Arena. "Explore the demo squad" opens the read-only demo squad. "Join with a code" opens the join flow (02, Join tab, code field focused).

AVOID
No eyebrow labels above headings, no split hero with copy on one side and a screenshot on the other, no rows of equal icon cards, no fake user counts or testimonials, no gradient text.
```

**Build notes.** Today's page claims "No XP, badges", but the current
Dossier shows achievements. The Dossier redesign (31) removes them, which
makes the claim true.

### 02 · Sign In / Join Squad (`/login`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Sign-in and sign-up in one place. Many people arrive from an invite link, so the squad they're joining is front and center. LeetCode is optional and must never block entry.

GOAL
Get into the Arena in under a minute. The focal point is the form card with its single primary action.

VIEWPORT
Desktop 1440 × 1024: the form card is centered, about 440 wide, with the wordmark above it and plenty of canvas around it. Mobile 390 × 844: the card fills the width with standard gutters, and the primary button stays visible above the keyboard.

LAYOUT ZONES
1. Wordmark and one line above the card.
2. Invite banner (only when arriving from an invite).
3. Form card.
4. Footnote below the card.

COMPONENT HIERARCHY
Above the card: wordmark "Mahayuddh"; the line "Practice DSA with your people."
Invite banner: avatar stack of 5, "Rahul invited you to Kshatriya", "5 members · 14-day squad streak"
Form card
  - Segmented control: "Sign in" | "Join" (Join selected)
  - Field "Your name": "Meera Rao"
  - Field group "What are you practicing for?": filter chips Internship prep · Full-time roles (selected) · Daily consistency
  - Field "Squad": shows "Joining Kshatriya" with a quiet "Change" link. Without an invite, the field is "Start a squad (optional)" with placeholder "e.g. Night Owls".
  - Field "LeetCode username (optional)": "meera_codes", helper "Everything works without it. Connecting lets us verify your solves."
  - Field "Email", Field "Password" (show/hide icon button)
  - Primary button full width: "Join Kshatriya"
  - Divider with "or", then a secondary button "Continue with GitHub" (only if OAuth is enabled)
Footnote: "Already have an account? Sign in" link

DATA
invite: from @rahul to squad Kshatriya, 5 members, squad streak 14 · name: Meera Rao · objective: Full-time roles · leetcode: meera_codes · email: meera.rao@gmail.com

STATES
Default: Join tab with the invite.
Sign-in tab: email, password, "Forgot password?" link, primary "Sign in".
No invite: no banner; the squad field becomes "Start a squad (optional)".
Error: an inline field error, e.g. under password "At least 8 characters". A form-level alert reads "That email already has an account. Sign in instead?" with a link.
Email confirmation sent: the card is replaced by "Check your inbox" with the email address and a "Resend" ghost button.
Submitting: the primary button shows a spinner and keeps its width.

INTERACTIONS
Submitting Join creates the account, joins the squad, and lands in the Arena with today's battle ready. Sign-in returns to the page they came from. Tab order runs top to bottom, and Enter submits.
```

**Build notes.** There's a live bug in sign-up at `app/login/page.tsx:142`:
`const squadName = username.trim()` shadows the "Start a squad" field,
so new squads are named after the person's username. GitHub OAuth doesn't
exist yet; render it only if it ships.

---

## 3. Core Practice Loop

### 03 · Arena — Daily Hub (`/home`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The Arena is the home screen. A squad member opens it once or twice a day to see today's problem, whether the squad is on track, and what's waiting for them. It's Monday evening: three squad mates already solved today's problem, a challenge from Rahul is waiting, and Prem hasn't solved anything yet today.

GOAL
Start today's battle in one click, and notice the open loops (a challenge, a squad streak that needs you today, a squad goal at 7 of 10) without reading anything dense. The focal point is Today's Battle Pass.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell. Mobile 390 × 844 inside the mobile shell.
Desktop shell: active nav "Arena", solve dock idle (one quiet line).
Mobile shell: tab "Arena" active, no solve capsule.

LAYOUT ZONES
Desktop
  1. Page heading row, full width: title "Arena" with one line beneath it.
  2. Focal column (about two-thirds): Today's Battle Pass (landscape), then "Up next", then "From your squad".
  3. Rail (about one-third): "Waiting on you", a short stack of compact rows, quiet surfaces, no competing big numbers.
Mobile
  Heading, then Today's Battle Pass (portrait, stub at the bottom), then "Waiting on you", then "Up next", then "From your squad".

COMPONENT HIERARCHY
Heading: "Arena"; line "Monday, 12 October · New pick at midnight"
Today's Battle Pass (signature Pass)
  Body
    - Problem title (Pass title style): "Coin Change II"
    - Meta row: difficulty badge Medium, pattern chip "Dynamic programming", "No. 518" in mono
    - Reason line: "Why this one · 2 reasons: unsolved in NeetCode 150, matches your squad goal pattern". "2 reasons" is a quiet disclosure that expands the list.
    - Social line: avatar stack (Priya, Rahul, Sneha), "Priya, Rahul and Sneha solved it · fastest 14:22 by @priya"
    - Actions: primary button large "Start battle"; ghost button "Open on LeetCode" with an external-link icon
  Stub (mono serial lines): "NO. 518", "12 OCT 2026", "KSHATRIYA", "3 OF 5 SOLVED"
Up next (card, quiet)
  - Heading "Up next"; problem row "Trapping Rain Water", No. 42, Hard, chip "Two pointers"
  - Reason: "Revenge available · you stopped at 41:06 three days ago" with "1 reason"
  - Actions: secondary button "Take revenge", ghost button "Not this"
From your squad (heading, plus 3 feed rows and a "See all in Feed" ghost link)
  - "Priya solved Coin Change II in 14:22" with a verified badge · 2h ago
  - "Sneha explained her approach to Container With Most Water" with chip "Two pointers" · 5h ago
  - "Rahul challenged Arjun: Word Ladder, beat 38:11" · yesterday
Rail: Waiting on you (heading; each row is a compact clickable card)
  - Challenge row: avatar Rahul, "Rahul challenged you", "Word Ladder · Hard · beat 38:11 · due Sun", chevron
  - Squad streak row: streak chip with an outlined flame "14", "Squad streak · 14 days", "3 of 5 solved today · you and Arjun haven't", tiny 5-dot row (3 filled)
  - Squad goal row: "Sweep the sliding-window set", a thin progress bar at 7 of 10, "7 of 10 · 5 days left · 3 of 5 contributed"
  - Review row: "3 problems due for review", "1 revenge · 1 fading · 1 weak pattern", chevron to Practice
  - LeetCode row (quiet, only when relevant): "Synced 4m ago"

DATA
date: Mon 12 Oct 2026 · todays_battle: {no: 518, title: "Coin Change II", difficulty: Medium, pattern: Dynamic programming, reasons: ["Unsolved in NeetCode 150", "Matches your squad goal pattern"], squad_solved: [{priya, 14:22, verified}, {rahul, 19:47, verified}, {sneha, 22:05, self-reported}], squad_size: 5}
up_next: {no: 42, title: "Trapping Rain Water", difficulty: Hard, pattern: Two pointers, reason: "Revenge available", last_attempt: failed at 41:06, 3 days ago}
waiting: challenge {from: rahul, problem: Word Ladder, beat: 38:11, due: Sun 18 Oct} · squad_streak {days: 14, solved_today: [priya, rahul, sneha], pending: [prem, arjun]} · goal {title: "Sweep the sliding-window set", done: 7, target: 10, days_left: 5, contributors: 3} · review_due: 3

STATES
Default: not solved today, with a challenge waiting (as above).
Battle running: the Pass body replaces its actions with "In progress · 08:14" in the mono timer style, primary "Resume", and ghost "Stuck?"; the dock is active.
Solved today: the Pass becomes your Proof card in place. Hero time "16:05" in the mono display style, verified badge, "Second fastest in your squad today". Below it, a "Next" row with three secondary actions: "Explain your approach", "Challenge Arjun to beat 16:05", "Compare with your squad". The rail's streak row turns to a filled flame: "4 of 5 solved today".
No squad: the social line reads "Practicing solo · Invite your people" with a ghost "Invite"; the rail shows "Start or join a squad" instead of streak and goal.
LeetCode not connected: solves show the self-reported badge, and the rail adds "Connect LeetCode to verify your solves" with a ghost button (never blocking).
Loading: skeletons matching the Pass and rail rows.
Error: an inline card, "Couldn't load today's battle. Try again." with a retry ghost button.

INTERACTIONS
"Start battle" starts the solve dock timer and opens the problem on LeetCode in a new tab. Hovering the avatar stack opens a popover listing each solver, their time, and verification. "2 reasons" expands the reason list inline. "Not this" swaps the Up next problem and briefly says why the next one was picked. Clicking a rail row opens its destination: the Challenge Pass (24), Squad Hub (13), or Practice (04).
```

**Build notes.** A shared squad streak isn't tracked yet. Today's "Squad
Streak" card adds members' personal streaks together, which breaks the
"never invent data" rule. Define it as consecutive days on which every
active member logged a solve (derivable from `problem_events`) before
shipping the streak row. "Fastest 14:22 by @priya" is derivable from squad
members' `battles.duration_sec` on today's slug. The "Your Progress" bars
and the "Browse topics" grid leave the Arena: progress lives on the
profile, and topics live in Practice.

### 04 · Practice Hub — Review Queue (`/practice`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Where a developer decides what to practice beyond today's battle: problems due for review (failed ones to take revenge on, solved ones that are fading), patterns that look weak, primers to learn first, and sheets to work through.

GOAL
Pick the single most valuable thing to practice now. The focal point is the top item of the review queue, a revenge on a failed problem, shown as a featured row with its reason and one primary action.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Practice", dock idle). Mobile 390 × 844 inside the mobile shell (tab "Practice").

LAYOUT ZONES
Desktop
  1. Heading row: "Practice" plus one line.
  2. Focal column (two-thirds): "Due for review", with the featured first item followed by a compact list.
  3. Rail (one-third): "Weak patterns" with an honesty note, then "Learn a pattern first".
  4. Full width below: "Start something new", three sheet rows with progress.
Mobile: stacked in the same priority order.

COMPONENT HIERARCHY
Heading: "Practice"; line "What to practice next, and why."
Due for review (heading with count "3")
  Featured item (card, slightly larger)
    - Problem title "Trapping Rain Water", No. 42 in mono, difficulty badge Hard, chip "Two pointers"
    - Reason line: "Revenge · you stopped at 41:06 three days ago"
    - Primary button "Take revenge"; ghost "Skip for now"
  Problem rows
    - "Minimum Window Substring", No. 76, Hard, chip "Sliding window" · "Fading · solved 24 days ago" · secondary button "Revisit"
    - "Course Schedule", No. 207, Medium, chip "Graphs" · "Weak pattern · Graphs" · secondary button "Start"
Weak patterns (heading) with a quiet note "An estimate from your history, not a grade."
  - Pattern row: chip "Graphs" · "3 solved · 2 failed · 1 revisit" · chevron
  - Pattern row: chip "Dynamic programming" · "6 solved · 3 failed" · chevron
  - Pattern row: chip "Heaps" · "2 solved · 0 failed · not touched in 19 days" · chevron
Learn a pattern first (heading)
  - Primer row: book icon, "Graph BFS in 10 minutes", "5 starter problems"
  - Primer row: "Sliding window in 8 minutes", "6 starter problems"
Start something new (heading)
  - Sheet row: "NeetCode 150", progress bar, "62 of 150 · 41%", ghost "Open"
  - Sheet row: "Blind 75", "41 of 75 · 55%"
  - Sheet row: "Striver SDE", "48 of 191 · 25%"

DATA
review_queue: [{no: 42, title: Trapping Rain Water, Hard, Two pointers, reason: revenge, failed_at: 41:06, ago: 3d}, {no: 76, Minimum Window Substring, Hard, Sliding window, reason: fading, solved_ago: 24d}, {no: 207, Course Schedule, Medium, Graphs, reason: weak pattern}]
weak_patterns: Graphs (3 solved, 2 failed, 1 revisit), Dynamic programming (6, 3), Heaps (2, 0, last touched 19 days ago)
primers: Graph BFS (5 starters), Sliding window (6 starters) · sheets: NeetCode 150 62/150, Blind 75 41/75, Striver SDE 48/191

STATES
Default: 3 due.
Nothing due: "Nothing due right now. Today's battle is still open." with a secondary button "Go to today's battle", and the sheets move up.
New user with no history: "Your review queue fills as you battle. Start with a primer or today's problem." with primers first.
Signed out: the page redirects to sign-in.
Loading: skeleton rows.

INTERACTIONS
"Take revenge" starts a battle on the problem, and the dock shows "Revenge · beat 41:06". Rows open the Problem Workspace (05). Pattern rows open the Pattern Hub (08). Primer rows open the Primer Reader (20). Sheet rows open the Roadmap Matrix (07). "Skip for now" pushes the item down the queue for a day.
```

**Build notes.** `review_queue` uses rule-based reasons with a fixed
14-day gap, not true spaced repetition, so the UI says "Due for review",
never "spaced repetition". The "Low confidence" reason never fires
because no UI sets `battles.confidence`. Either add a one-tap confidence
rating after a solve, or drop that reason.

### 05 · Problem Workspace (`/practice/[slug]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Everything about one problem in one place: your battles on it, your squad's times and approaches, your own write-up, and practice helpers. Prem's latest battle on Longest Substring Without Repeating Characters (Saturday) beat his previous best by over eight minutes, and he hasn't written up his approach yet.

GOAL
Celebrate the result and take the next step: explain, challenge, or compare. The focal point is the latest battle result card, with its improvement and next actions.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Practice", breadcrumb "Practice / Longest Substring Without Repeating Characters", dock idle). Mobile 390 × 844 inside the mobile shell (tab "Practice").

LAYOUT ZONES
Desktop
  1. Problem header, full width.
  2. Focal column (two-thirds): the latest battle result card, then underline tabs and the tab content.
  3. Rail (one-third): "Your squad on this problem", "Open challenges", "Learn first".
Mobile: header, result card, tabs (horizontally scrollable), then the rail sections collapsed into accordions below.

COMPONENT HIERARCHY
Problem header
  - Title (page title style): "Longest Substring Without Repeating Characters"
  - Meta row: "No. 3" mono, difficulty badge Medium, pattern chips "Sliding window" and "Hash map"
  - Status line: verified badge, "Solved · best 15:06"
  - Actions: secondary button "Battle again", ghost "Open on LeetCode", icon button bookmark, overflow menu (Mark attempted, Mark solved manually)
Latest battle result card
  - Hero time "15:06" in the mono display style with "Personal best" beside it
  - Improvement line: "23:40" struck through, then "→ 15:06 · 8m 34s faster"
  - Evidence line: verified badge, "Matched an accepted LeetCode submission"
  - Stats line, quiet: "2 attempts · 1 revisit · challenged 3 people · 2 friends solved it"
  - Next row: primary button "Explain your approach"; secondary "Challenge someone"; secondary "Compare with squad"; ghost "Share proof"
Tabs: "Your battles" (active) · "Squad approaches 3" · "Your approach" · "Practice with AI"
  Your battles (timeline, newest first)
    - "Solved · 15:06 · Sat 10 Oct, 21:14" verified badge
    - "Revisited · 23:40 · 26 Sep" verified badge
    - "Failed · 31:10 · 19 Sep" self-reported badge, with a note "Stopped: off-by-one on window shrink"
Rail
  Your squad on this problem (heading)
    - Row: avatar Priya, "Priya", "12:58" mono, verified badge
    - Row: avatar Prem (you), "You", "15:06", verified
    - Row: avatar Rahul, "Rahul", "19:47", verified
    - Row: avatar Arjun, "Arjun", "Attempted", no time
    - Row: Sneha, "Not yet"
  Open challenges: "You → Arjun · beat 15:06 · due Fri" with status "Open"
  Learn first: primer row "Sliding window in 8 minutes"

DATA
problem: {no: 3, title: "Longest Substring Without Repeating Characters", difficulty: Medium, patterns: [Sliding window, Hash map]}
latest_battle: {duration: 15:06, previous_best: 23:40, delta: -8:34, personal_best: true, evidence: leetcode, attempts: 2, revisits: 1, challenged_out: 3, friends_solved: 2}
history: [{solved, 15:06, 10 Oct, leetcode}, {revisited, 23:40, 26 Sep, leetcode}, {failed, 31:10, 19 Sep, self, note}]
squad: priya 12:58 verified · prem 15:06 verified · rahul 19:47 verified · arjun attempted · sneha none

STATES
Default: solved, no approach written yet, "Your battles" tab.
Not attempted yet: no result card. The header's primary action is "Start battle", the "Squad approaches" tab shows "Solve it first, or reveal anyway", and the rail lists squad times (times are fine to see; code stays hidden).
Failed last time: the result card reads "Stopped at 31:10", with primary "Take revenge" and secondary "Ask for a hint" (opens the Stuck ladder).
Squad approaches tab: approach cards with author, core idea, and complexity, with code behind a Reveal code panel.
Your approach tab (only after a solve): a short form with "Core idea in two sentences" (required) and disclosures for Pattern, Time, Space, Key detail, Edge cases, Mistakes, Code; visibility segmented control Private | Squad | Public; primary "Save approach".
Practice with AI tab: three tools, "Explain it back" (you explain, it questions you), "Interview simulation", and "Explain my mistake", each with a one-line description and a secondary "Start". They never hand over code.

INTERACTIONS
"Explain your approach" switches to the "Your approach" tab and focuses the first field. "Challenge someone" opens the Send Challenge modal (30), prefilled with this problem and your time. "Compare with squad" opens Compare (06). "Share proof" opens the share sheet for the Battle Proof page (23). Clicking a squad row opens that person's approach if they shared one.
```

**Build notes.** The tabs reorganize today's single long page (history,
approaches, explain form, AI tools, open challenges, recent activity) by
progressive disclosure. The data is unchanged.

### 06 · Compare Squad Approaches (`/practice/[slug]/compare`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
After solving, a developer wants to see how their squad thought about the same problem: the same technique, a different trick, or a completely different idea. This is where learning from your people happens.

GOAL
Spot the difference between approaches in seconds. The focal point is the side-by-side approach columns grouped by technique, with code hidden until you choose to reveal it.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Practice / Longest Substring… / Compare", dock idle). Mobile 390 × 844 inside the mobile shell; columns become a horizontal swipe between approach cards, with a segmented control to jump between them.

LAYOUT ZONES
1. Heading row: title plus a summary line.
2. "Where they differ": a short list of three plain sentences.
3. Approach columns: three equal columns on desktop, grouped under technique headings.
4. Footer action row.

COMPONENT HIERARCHY
Heading: "How your squad solved Longest Substring Without Repeating Characters"; line "3 approaches · 2 techniques"
Where they differ (heading)
  - "Priya and you both shrink the window with a hash map; Rahul jumps the left edge using a last-seen index array."
  - "Rahul's version allocates a fixed 128-slot array, so space is O(1) for ASCII."
  - "You're the only one who handled the empty string explicitly."
Technique group 1: heading "Sliding window + hash map" with "2 people"
  Approach card (Priya)
    - Avatar, "Priya Nair", verified badge, "12:58"
    - Core idea: "Grow the right edge; when a repeat shows up, move left past the previous occurrence. Track the max width as you go."
    - Complexity row: "Time O(n)" · "Space O(min(n, k))" in mono
    - Disclosures: Key detail, Edge cases, Mistakes
    - Reveal code panel (collapsed): "Python · 14 lines", secondary button "Reveal code"
  Approach card (You), with a "You" tag
    - Same structure: "15:06", core idea "Same window, but I store indices and jump left in one step instead of shrinking one by one."
Technique group 2: heading "Last-seen index array" with "1 person"
  Approach card (Rahul): "19:47", core idea "Fixed 128-int array of last positions; left = max(left, last[c] + 1)." Complexity "Time O(n)" · "Space O(1)"
Footer row: secondary "Challenge Priya to a rematch", ghost "Back to problem"

DATA
approaches: [{priya, 12:58, verified, technique: "Sliding window + hash map", time: O(n), space: O(min(n,k)), lang: Python, lines: 14}, {prem, 15:06, verified, same technique, lang: Python, lines: 16}, {rahul, 19:47, verified, technique: "Last-seen index array", time: O(n), space: O(1), lang: C++, lines: 12}]

STATES
Default: 3 approaches, code hidden.
Code revealed: a code block with syntax highlighting, line numbers, and a copy icon button; other columns stay hidden.
You haven't attempted: each Reveal code panel adds "You haven't attempted this yet", and the page leads with a secondary "Start battle".
Only one approach: "Only Priya has shared an approach so far." with a primary "Write yours".
None: an empty state, "Nobody in your squad has shared an approach yet. Yours could be the first." with a primary "Explain your approach".

INTERACTIONS
Each "Reveal code" acts independently. Disclosures expand in place. Hovering an author opens their hover preview. "Challenge Priya to a rematch" opens the Send Challenge modal (30) prefilled with her time.
```

**Build notes.** "Where they differ" exists today. If it's generated by
the AI provider, mark it with a quiet "Summary written by AI" line under
the heading.

### 07 · Roadmap Matrix (`/sheets/[slug]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A curated sheet (here NeetCode 150) shown as a matrix: every problem is a cell, grouped by category, so progress and gaps are visible at a glance, along with where the squad has been.

GOAL
See which category to attack next and start a problem from it. The focal point is the matrix overview, categories as rows of cells.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (sidebar "Sheets › NeetCode 150" active, dock idle). Mobile 390 × 844 inside the mobile shell; the matrix becomes a vertical list of categories, each with a wrapped row of cells.

LAYOUT ZONES
1. Heading row: title, description, and a progress summary on the right.
2. Matrix overview: one row per category, with the category name and count on the left and a row of status cells on the right.
3. Toolbar: search field, status filter chips, and a "Show squad" toggle.
4. Problem list grouped by category below, with collapsible groups.

COMPONENT HIERARCHY
Heading: "NeetCode 150"; line "A structured path through the 150 problems that cover the core patterns."
Progress summary: "62 of 150" with a thin progress bar; "Easy 24/28 · Medium 34/101 · Hard 4/21"
Matrix overview (one row per category; 18 categories total; show these 8 and then "Show all 18")
  - "Arrays & hashing 9/9": 9 cells, all verified
  - "Two pointers 4/5": 4 verified, 1 empty
  - "Sliding window 3/6": 2 verified, 1 self-reported, 2 attempted, 1 empty
  - "Stack 5/7"
  - "Binary search 4/7"
  - "Linked list 6/11"
  - "Trees 8/15"
  - "Graphs 3/13": mostly empty
  Each cell is a matrix cell; hovering shows the title, your status, and squad solvers.
Toolbar: search "Search this sheet"; filter chips All (selected) · Solved · Attempted · To do; toggle "Show squad"
Problem list
  Category group "Sliding window": header with "3 of 6" and a chevron
    - Problem row: verified check, "Best Time to Buy and Sell Stock", No. 121, Easy, squad hint "4 solved", best "03:12"
    - Problem row: verified, "Longest Substring Without Repeating Characters", No. 3, Medium, "4 solved", "15:06"
    - Problem row: self-reported check, "Longest Repeating Character Replacement", No. 424, Medium, "2 solved", "27:40"
    - Problem row: half circle (attempted), "Permutation in String", No. 567, Medium, "1 solved"
    - Problem row: half circle, "Minimum Window Substring", No. 76, Hard, "1 solved"
    - Problem row: empty, "Sliding Window Maximum", No. 239, Hard, "0 solved"; hover reveals a ghost "Start"
  Category group "Graphs" (collapsed): "3 of 13"

DATA
sheet: NeetCode 150 · solved 62/150 · by difficulty: Easy 24/28, Medium 34/101, Hard 4/21 · categories with per-problem status in {verified, self-reported, attempted, none} · per problem: squad_solved_count, your_best_time

STATES
Default: as above.
Show squad on: each cell gets a small count dot showing how many squad mates solved it, and rows show an avatar stack instead of "4 solved".
Filter empty: "No problems match these filters." with a ghost "Clear filters".
Loading: matrix and list skeletons.
Squad custom list: the same layout, titled with the list name and "Made by Rahul for Kshatriya".

INTERACTIONS
Clicking a matrix cell scrolls to and highlights its row. Clicking a category name filters the list to that category. Rows open the Problem Workspace (05); the "Start" ghost on hover starts a battle directly. Group headers collapse. "Show squad" persists per person.
```

**Build notes.** Today's group-level "Mark Solved" and "Reset" bulk
actions move into each group header's overflow menu, because bulk
self-marking weakens proof. The squad overlay needs read access to squad
members' `user_problem_status`; check the RLS before building.

### 08 · Pattern Hub (`/patterns/[topic]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A single pattern's home, here Sliding window. It's the place to learn the idea, practice the starter problems in order, see who in the community teaches it well, and help a squad mate who's stuck on it.

GOAL
Go from "I don't get sliding window" to starting the right first problem. The focal point is the learning path: the primer followed by the ordered starter problems.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Practice / Patterns / Sliding window", dock idle). Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Heading row: pattern name and a "recognize it when" line.
2. Focal column (two-thirds): learning path card (primer, then starter problems).
3. Rail (one-third): "Where your squad is stuck", "Who teaches this well".
4. Full width below: "Common mistakes" and "From the vault" side by side, then "Community approaches".

COMPONENT HIERARCHY
Heading: title "Sliding window" with a pattern chip "Pattern"; line "Reach for it when the answer is a contiguous subarray or substring and you can update the condition as the window moves."
Your progress line: "You've solved 3 of 6 starter problems · squad 14 total"
Learning path (card)
  - Primer row: book icon, "Sliding window in 8 minutes", "Read · 8 min", secondary button "Read primer"
  - Divider
  - Starter problems (ordered): numbered rows, where the numbers carry the real recommended order
    1. "Best Time to Buy and Sell Stock" Easy, verified check
    2. "Longest Substring Without Repeating Characters" Medium, verified check
    3. "Longest Repeating Character Replacement" Medium, self-reported check
    4. "Permutation in String" Medium, empty, highlighted as the next one, with primary button "Start battle"
    5. "Minimum Window Substring" Hard, attempted
    6. "Sliding Window Maximum" Hard, empty
Rail: Where your squad is stuck (heading)
  - Row: avatar Arjun, "Arjun is stuck on Minimum Window Substring", "wants a pattern hint · 2h ago", secondary button "Help"
Rail: Who teaches this well (heading)
  - Row: avatar Priya, "Priya Nair", "6 approaches · copied 11 times"
  - Row: avatar Lena, "Lena Park", "4 approaches · copied 23 times"
Common mistakes (heading): three short rows. "Shrinking the window one step at a time when you could jump." / "Forgetting to update the answer after the loop ends." / "Using a set when you need counts."
From the vault (heading): row "Sliding window template (Python)", "Cheat sheet · by @priya", ghost "Copy to my notebook"
Community approaches (heading): three approach excerpt rows with author, problem, core idea, and a pattern chip, plus "See all 18"

DATA
pattern: Sliding window · your_starters_solved: 3/6 · squad_solves: 14 · primer: {title: "Sliding window in 8 minutes", minutes: 8} · starters: [121 Easy verified, 3 Medium verified, 424 Medium self-reported, 567 Medium none (next), 76 Hard attempted, 239 Hard none] · stuck: {arjun, problem: Minimum Window Substring, level: Pattern hint, ago: 2h} · teachers: priya (6 approaches, 11 copies), lena (4, 23)

STATES
Default: as above.
No primer exists for this pattern: the path starts with the starter problems, and a quiet line reads "No primer yet for this pattern."
Nobody stuck: the rail section is hidden (not shown empty).
All starters done: the path card says "You've done all 6. Try one from the community list or take revenge on a failed one." with secondary "See review queue".

INTERACTIONS
"Read primer" opens the Primer Reader (20). "Start battle" on the next starter starts the dock. "Help" opens that stuck request in the Stuck ladder (09) with a reply composer limited to the requested level. Teacher rows open profiles (22). Vault rows copy into the Notebook (18) with a toast "Copied to your notebook" and "Open".
```

**Build notes.** `/patterns` has no index page. Either add one (all
patterns with your solved counts) or point every pattern link straight at
a hub. The mobile tab bar no longer links there.

### 09 · Stuck Ladder — Tiered Peer Help (`/stuck`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
When someone's stuck, they ask for exactly as much help as they want: a nudge, a pattern hint, a direction, or a full explanation. Squad mates answer at that level or lower, never more. This page has two sides: helping others, and tracking your own requests.

GOAL
Help a squad mate at exactly the level they asked for. The focal point is the oldest open request, with the ladder showing which rung they're on.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Practice / Stuck requests", dock idle). Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Heading row: title, one line, and underline tabs.
2. The ladder: a horizontal strip of four rungs explaining the levels, compact and always visible at the top of the list (vertical on mobile).
3. Request list: request cards, the first one expanded with a reply composer.

COMPONENT HIERARCHY
Heading: "Stuck requests"; line "Help at the level someone asked for, no more."
Tabs: "Help someone 2" (active) · "My requests 1"
The ladder (4 rungs, left to right, each with its name and promise)
  1. "Nudge": "A question that points the way."
  2. "Pattern hint": "Names the technique, not the steps."
  3. "Direction": "The approach in plain words, no code."
  4. "Full explanation": "Walk through the whole solution."
Request card (expanded)
  - Avatar Arjun, "Arjun Mehta", "2h ago"
  - Problem row (compact): "Minimum Window Substring", No. 76, Hard, chip "Sliding window"
  - Level: the ladder rung "Pattern hint" highlighted in the card's mini-ladder (rungs 1–2 active, 3–4 dimmed)
  - Arjun's note: "My window never shrinks correctly when there are duplicates in t."
  - Reply composer
    - Level selector (segmented control) with only "Nudge" and "Pattern hint" enabled; "Direction" and "Full explanation" are disabled with a tooltip "Arjun asked for a pattern hint"
    - Textarea, placeholder "Name the technique without walking through the steps…"
    - Primary button "Send hint"
Request card (collapsed)
  - "Someone in your squad" (anonymous), "Coin Change II", "Nudge", "5h ago", secondary button "Help"

DATA
requests_for_you: [{arjun, problem: 76 Minimum Window Substring, level: Pattern hint, note, age: 2h, visibility: squad}, {anonymous, problem: 518 Coin Change II, level: Nudge, age: 5h}]
my_requests: [{problem: 42 Trapping Rain Water, level: Direction, status: helped, replies: 1}]

STATES
Default: "Help someone" tab.
My requests tab: your request card for "Trapping Rain Water · Direction · Helped". Rahul's reply sits inside it as a reply block with its level tag. Actions: primary "This unblocked me", secondary "I solved it", ghost "Delete request".
Reply accepted: the reply shows an "Unblocked" tag (verified style only if the asker then logged a verified solve).
Empty, help tab: "Nobody in your squad is stuck right now."
Empty, my tab: "When you're stuck mid-battle, hit Stuck? in the solve dock to ask."
Ask popover (from the dock's "Stuck?"): the four rungs as selectable cards with an example each; visibility segmented control My squad | Public | Anonymous; primary "Ask for a pattern hint" (the label follows the selected rung).

INTERACTIONS
The level selector can't exceed the requested rung. Sending a reply notifies the asker. "This unblocked me" marks the request helped; "I solved it" resolves it and offers "Explain what clicked" (opens the approach form).
```

---

## 4. Social & Squad

### 10 · Squad Activity Feed (`/feed`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The squad's shared timeline: solves, challenges, approaches, stuck requests, discussions, and milestones. It feels like Strava for code: celebrating effort and teaching, not a noisy social network. Tabs widen the circle from your squad to people you follow, to everyone, and to product updates.

GOAL
Catch up on what your people did since you last looked, and act on one thing (compare, help, or reply). The focal point is the stream itself, with the newest squad solve at the top.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Feed", dock idle). Mobile 390 × 844 inside the mobile shell (tab "Feed"), where the composer collapses to a floating secondary "Post" button above the tab bar.

LAYOUT ZONES
Desktop
  1. Heading row: title, underline tabs, and a one-line purpose for the selected tab.
  2. Stream column (centered, reading width): a composer prompt row, then feed items.
  3. Rail (one-third, quiet): "This week in Kshatriya" plus a recap link.
Mobile: heading, tabs, then the stream; the rail summary becomes a single row at the top of the stream.

COMPONENT HIERARCHY
Heading: "Feed"
Tabs: "Squad" (active) · "Following" · "Global" · "Updates"
Purpose line: "What Kshatriya has been up to."
Composer row: your avatar, a field-like button "Share a solve, teach something, or ask for help…", secondary button "Post"
Feed items (newest first)
  1. Solve: avatar Priya, "Priya solved Coin Change II in 14:22", verified badge, "2h ago". Embedded mini Proof card: title, "14:22", "Dynamic programming", "No. 518". Actions: ghost "Compare", ghost "Challenge Priya", overflow ⋯
  2. Approach: avatar Sneha, "Sneha explained Container With Most Water", chip "Two pointers", "5h ago". Excerpt (two lines of body text): "Start with the widest container and always move the shorter wall, because moving the taller one can never help." Footer: "Proven useful · Arjun copied it and solved it". Actions: ghost "Read approach", ⋯
  3. Challenge: avatar Rahul, "Rahul challenged Arjun on Word Ladder", difficulty badge Hard, "Beat 38:11", "yesterday". Action: ghost "View challenge"
  4. Stuck: avatar Arjun, "Arjun asked for a pattern hint on Minimum Window Substring", "yesterday". Action: secondary "Help"
  5. Discussion: avatar Prem, "Is it worth memorizing the union-find template, or deriving it each time?", chips "Graphs" "Union find", "2 replies". Action: ghost "Reply"
  6. Milestone: flame icon, "Kshatriya reached a 14-day squad streak", "Sun". Action: ghost "Share"
"Show older" ghost button at the end
Rail: This week in Kshatriya (heading)
  - Quiet stat rows: "Solves 27" · "Challenges 6 sent, 4 beaten" · "Approaches 5" · "Stuck asks 2"
  - Link row: "Last week's recap is ready" with a chevron

DATA
feed: [{type: solve, actor: priya, problem: Coin Change II, time: 14:22, verified, ago: 2h}, {type: teach, actor: sneha, problem: Container With Most Water, pattern: Two pointers, downstream: "arjun copied and solved", ago: 5h}, {type: challenge, actor: rahul, target: arjun, problem: Word Ladder, beat: 38:11}, {type: stuck, actor: arjun, problem: Minimum Window Substring, level: Pattern hint}, {type: discuss, actor: prem, replies: 2, tags: [Graphs, Union find]}, {type: squad_milestone, title: "14-day squad streak"}]
week: solves 27, challenges_sent 6, challenges_completed 4, approaches 5, stuck_requests 2

STATES
Default: Squad tab.
Following tab: the same item types from people you follow. Empty: "Follow people from their profile to see their solves here."
Global tab: public items from everyone. Each item shows the author's squad name.
Updates tab: product and contest posts with a "Pinned" tag, title, body, and "Open". Example: "Weekly Contest 471 starts Sunday 08:00 IST".
No squad: "Join or start a squad to see your people here." with a primary "Start a squad" and a secondary "Join with a code".
Loading: item skeletons.

INTERACTIONS
The composer row opens the Post to Feed modal (29). "Compare" opens Compare (06). "Challenge Priya" opens Send Challenge (30) prefilled with her time. "Help" opens the stuck request (09). Discussion items expand their thread inline with a reply field. The ⋯ menu offers Report, Block, and (on your own items) Delete.
```

**Build notes.** "Proven useful" uses the real downstream-action signal
that exists today ("Proven useful, recently" / "No downstream action
yet"). There are deliberately no like counts.

### 11 · Suggestion Box & Duels (`/challenges`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Async 1v1 challenges between friends: "solve this, and beat my time if you can". Challenges can be passed along, forming chains (Prem → Rahul → Arjun). Nothing is live and nothing is wagered; it's a friendly nudge with a time to beat.

GOAL
Answer the challenge that's waiting for you. The focal point is the 1v1 Challenge Pass from Rahul at the top.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Challenges" with count 1, dock idle). Mobile 390 × 844 inside the mobile shell (reached from the Arena rail or the drawer).

LAYOUT ZONES
1. Heading row: title, one line, and a secondary "New challenge" button on the right.
2. Focal: the Challenge Pass for the open challenge targeting you (landscape on desktop, portrait on mobile).
3. Underline tabs for the list below.
4. Challenge list: rows, with chains shown inline.

COMPONENT HIERARCHY
Heading: "Challenges"; line "Friendly 1v1s. Solve it, beat their time, pass it on."
1v1 Challenge Pass (signature Pass)
  Body
    - "Rahul challenged you" (title style) with Rahul's avatar
    - Problem: "Word Ladder", difficulty badge Hard, "No. 127", chip "Graphs"
    - Hero: "Beat 38:11" in the mono display style
    - Note in quotes: "Took me two tries. Think hard about the visited set."
    - Actions: primary button large "Accept challenge"; ghost "Pass it on"; ghost "Not now"
  Stub (mono serial lines): "FROM @RAHUL", "TO @PREM", "DUE 18 OCT", "OPEN"
Tabs: "All" · "For you 1" · "Sent 2" · "Done 7"
Challenge rows (All tab)
  - "You → Arjun", "Longest Substring Without Repeating Characters", Medium, "Beat 15:06", "due Fri", status "Open", ghost "Remind" (disabled with tooltip "You can remind once a day · next at 21:40")
  - "You → Sneha", "Coin Change II", Medium, "Beat 16:05", status "Beaten · Sneha 15:41", verified badge
  - Chain row: "Prem → Rahul → Arjun", "Course Schedule", Medium, a three-hop chain line with avatars, where each hop shows its state (beaten, beaten, open)
  - "Priya → You", "Two Sum", Easy, "Beat 03:12", status "Done · you 02:58", verified badge
  - "Kabir → You", "Valid Anagram", Easy, status "Expired", self-reported badge omitted

DATA
open_for_you: {from: rahul, to: prem, problem: {no: 127, Word Ladder, Hard, Graphs}, beat: 38:11, note: "Took me two tries. Think hard about the visited set.", due: 18 Oct, spoiler: false}
sent: [{to: arjun, problem: 3, beat: 15:06, due: Fri, status: open, reminded: today}, {to: sneha, problem: 518, beat: 16:05, status: completed, her_time: 15:41, verified}]
chain: {problem: 207 Course Schedule, hops: [prem→rahul beaten, rahul→arjun open]}

STATES
Default: one challenge waiting for you.
Nothing waiting: the Pass is replaced by a quiet card, "No open challenges for you. Send one to someone in your squad." with a secondary "New challenge" (the header button hides to avoid duplicates).
Hidden note (spoiler): the note line reads "Rahul left a hint. It unlocks when you finish." with a lock icon.
After accepting: the Pass shows "In progress · 12:40" and the dock is active.
Beaten: the Pass flips to "You beat Rahul · 31:02 vs 38:11", verified badge, and next actions "Pass it on" (secondary) and "Share" (ghost).
Missed it: "38:11 still stands · you finished in 44:20". No shaming; offers "Try again later" and "Read Rahul's approach".

INTERACTIONS
"Accept challenge" starts a battle with "Beat 38:11" shown in the dock. "Pass it on" opens Send Challenge (30) with the same problem and your time, adding a hop to the chain. "Not now" keeps it in "For you" without notifying Rahul. Clicking a chain row expands the full chain. Rows open the Challenge Deep-Link page (24).
```

**Build notes.** Today's 1v1 modal is inline in
`app/challenges/page.tsx`; extract it into a shared component for 30. The
"Suggestion Box" name stays in the route history only; the page title is
"Challenges".

### 12 · Leaderboard (`/leaderboard`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Friendly standings. The squad board is about your people this week. The global board celebrates movement (rising, most improved) more than raw totals. All numbers are measured, and LeetCode-derived metrics say so.

GOAL
See where you stand among your squad and who's moving, then challenge someone. The focal point is the squad ranking list, with your row pinned and visible.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Leaderboard", dock idle). Mobile 390 × 844 inside the mobile shell, where the list keeps rank, avatar, name, and metric; the change indicator moves under the metric.

LAYOUT ZONES
1. Heading row: title and the scope segmented control (Squad | Global).
2. Controls row: metric filter chips and a period segmented control.
3. Ranking list (reading width, centered).
4. Footer note on data sources.

COMPONENT HIERARCHY
Heading: "Leaderboard"; segmented control "Squad" (selected) | "Global"
Controls: filter chips "Verified solves" (selected) · "Streak" · "Hard solved" · "Contest rating"; segmented "Last 7 days" (selected) | "All time"
Ranking list (leaderboard rows)
  - 1 · avatar Priya · "Priya Nair" "@priya" · "9" verified solves · change "—"
  - 2 · avatar Prem · "Prem Sai (you)" · "6" · change "↑1". This row is the current user, highlighted.
  - 3 · Rahul Verma · "5" · "↓1"
  - 4 · Sneha Iyer · "4" · "—"
  - 5 · Arjun Mehta · "3" · "↑1"
  Hover on a row reveals ghost actions: "Dossier", "Challenge"
Footer note (caption): "Verified solves come from LeetCode sync. Contest rating comes from LeetCode."

DATA
scope: squad · metric: verified_solves · period: last 7 days
rows: priya 9 (=), prem 6 (+1), rahul 5 (-1), sneha 4 (=), arjun 3 (+1)
all_time alt: priya 142, rahul 118, prem 105, sneha 96, arjun 74 · streak alt: priya 31, prem 23, rahul 19, sneha 17, arjun 14 · contest alt: rahul 1,642, prem 1,584, priya 1,560, arjun —, sneha —

STATES
Default: squad, verified solves, last 7 days.
Global scope: segment chips "Rising" (selected) · "Most improved" · "By pattern" · "Recently active" · "Most solved". Rows add a squad name. Your global row is pinned at the bottom when you're off-page ("You · #1,284 · rising 212 places"). Pagination: "Show more".
Contest rating with unlinked members: those rows show "—" and a quiet "Not linked". A toggle "Linked only" appears.
Not linked yourself: your row shows "Connect LeetCode to appear here" with a ghost button.
Loading: row skeletons.

INTERACTIONS
Metric and period changes re-rank with a short reorder animation (rows slide; no flashing). Clicking a row opens the Warrior Dossier (31). "Challenge" opens Send Challenge (30) for that person.

AVOID
No medals, trophies, crowns, podium layout, or gold on ranks. No composite "score" without its formula.
```

**Build notes.** Today's board leads with an unexplained composite
"Score" and 8 sortable columns. The redesign uses one metric at a time.
Drop "Score" unless its formula is shown. "Hard solved" and "Contest
rating" come from `profiles`; "Verified solves (7 days)" needs a query
over `battles` with `evidence = leetcode`.

### 13 · Squad Hub (`/squad`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The squad's home: the shared streak, the current goal, the members, the season, and the invite. Squad retention is the product's north star, so this page makes the group feel real and worth showing up for.

GOAL
Feel the squad's momentum and know what the group needs from you today. The focal point is the Squad Streak card, a Pass showing 14 days and who kept it alive each day.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Squad", dock idle). Mobile 390 × 844 inside the mobile shell (tab "Squad").

LAYOUT ZONES
Desktop
  1. Heading row: squad name with the switcher, member count, and header actions.
  2. Focal column (two-thirds): Squad Streak Pass, then the goal card, then members.
  3. Rail (one-third): invite card, season card, links to Wall and Recaps, weekly rhythm.
Mobile: heading, Streak Pass (portrait), goal, members, invite, season, links.

COMPONENT HIERARCHY
Heading: "Kshatriya" with a chevron squad switcher; line "5 members · since 3 Aug 2026"; header actions: ghost "Join with code", secondary "New squad"
Squad Streak Pass (signature Pass)
  Body
    - Streak flame (outlined: today not complete) with "14 days" in the large numeral style
    - Line: "3 of 5 solved today · Prem and Arjun to go"
    - 7-day grid: 5 rows (one per member, avatar plus first name) × 7 columns (Tue–Mon). Small dots: filled = solved that day, hollow = not yet today. All filled for the past 6 days; today: Priya, Rahul, and Sneha filled, Prem and Arjun hollow.
    - Action: primary button "Solve today's battle"
  Stub (mono serial lines): "KSHATRIYA", "SINCE 28 SEP", "5 MEMBERS", "BEST 21 DAYS"
Goal card
  - Title "Sweep the sliding-window set", chip "Sliding window"
  - Progress: thin bar at 7 of 10, "7 of 10 · 5 days left"
  - Line: "3 of 5 members have contributed · Sneha and Arjun haven't yet"
  - Actions: ghost "Edit goal", ghost overflow (Mark complete, Archive)
Members (heading, 5 rows)
  - Avatar, "Priya Nair", "9 solves this week · 31-day streak", ghost "Challenge"
  - "Prem Sai (you)", "Admin", "6 solves · 23-day streak"
  - "Rahul Verma", "5 solves · 19-day streak"
  - "Sneha Iyer", "4 solves · 17-day streak"
  - "Arjun Mehta", "3 solves · 14-day streak"
Rail: Invite card: "Invite your people", invite code "KQ7X2P9M" in mono with a copy icon button, secondary "Copy invite link", caption "3 opened · 1 joined"
Rail: Season card: "Season 01 — Graph War", "Ended 11 Oct", "41 of 40 graph problems · objective met", ghost "See season summary"
Rail: Links: "Squad wall" (chevron), "Weekly recaps · last: 5–11 Oct" (chevron)
Rail: Weekly rhythm (quiet): "Mon: new goal · Wed: challenge day · Sun: recap"

DATA
squad: {name: Kshatriya, members: 5, created: 3 Aug 2026, invite_code: KQ7X2P9M, invite_stats: {opened: 3, joined: 1}}
squad_streak: {days: 14, since: 28 Sep, best: 21, today_solved: [priya, rahul, sneha], today_pending: [prem, arjun], grid_7d: per member booleans}
goal: {title: "Sweep the sliding-window set", pattern: Sliding window, done: 7, target: 10, days_left: 5, contributors: [priya, prem, rahul]}
members: [{priya, 9, 31}, {prem, admin, 6, 23}, {rahul, 5, 19}, {sneha, 4, 17}, {arjun, 3, 14}]
season: {name: "Season 01 — Graph War", ended: 11 Oct, objective: 40 graph problems, result: 41}

STATES
Default: streak alive, today in progress.
Today complete: the flame fills, the line reads "All 5 solved today. Day 15 starts at midnight.", and the primary action becomes a secondary "Share streak".
Streak broken: the flame is outlined and quiet, "0 days · the 14-day run ended Sunday", "Best: 21 days". No blame and no names of who missed. Action: "Start a new run today".
Solo (one member): the Streak Pass is replaced by an invite-first card, "Squads keep each other going. Invite 1–6 people." with a primary "Copy invite link".
Multiple squads: the switcher lists them with member counts.
No goal: the goal card says "No goal yet. Pick something the whole squad can finish in a week or two." with a secondary "Set a goal".

INTERACTIONS
"Solve today's battle" goes to the Arena with the battle ready. Hovering a grid dot shows "Rahul · Sun 11 Oct · solved Coin Change at 23:10". "Challenge" on a member opens Send Challenge (30). The invite copy actions give toast confirmations. "Leave squad" lives in the switcher menu behind a confirmation dialog (danger button).
```

**Build notes.** This is where the squad-streak definition matters most:
see 03's build notes. `squads.shared_goal_text` and `season_name` exist
but are never shown; this design shows the goal from `squad_goals` and
the season from `squad_seasons`. There's no UI to create seasons today.

### 14 · Squad Wall — Verified Milestones (`/squad/[id]/wall`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The squad's trophy wall, kept honest: a timeline of real milestones (first hard solves, streak records, goals completed, teaching milestones). Each one is backed by recorded activity, and verified ones say so.

GOAL
Feel proud of what the squad has done together and share a moment. The focal point is the most recent milestone, shown large at the top.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Squad / Wall", dock idle). Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Heading row: title and one line.
2. Latest milestone: a featured card, larger, with a share action.
3. Timeline: a vertical line with milestone entries grouped by month (reading width).

COMPONENT HIERARCHY
Heading: "Kshatriya's wall"; line "Every milestone here happened. Verified ones are marked."
Latest milestone (featured card)
  - Flame icon, title "14-day squad streak", detail "Every member solved at least one problem every day from 28 Sep to 11 Oct.", "Sun 11 Oct"
  - Ghost "Share"
Timeline: month heading "October"
  - Entry: "Season 01 — Graph War complete", "41 of 40 graph problems", "11 Oct"
  - Entry: "Priya's first Hard, verified", "Word Ladder in 44:10", verified badge, "8 Oct"
  - Entry: "Rahul wrote his 10th approach", "Copied 17 times across 4 squads", "4 Oct"
Month heading "September"
  - Entry: "Goal complete: Two pointers set", "10 of 10 in 6 days", "26 Sep"
  - Entry: "Sneha's longest challenge chain", "Passed through 4 people · Course Schedule", "19 Sep"
  - Entry: "Arjun joined", "Invited by Rahul", "3 Sep"

DATA
milestones: [{kind: squad_streak, title: "14-day squad streak", date: 11 Oct}, {kind: first_hard, member: priya, problem: Word Ladder, time: 44:10, verified, date: 8 Oct}, {kind: season_complete, date: 11 Oct}, {kind: teaching, member: rahul, count: 10, copies: 17, date: 4 Oct}, {kind: goal_complete, date: 26 Sep}, {kind: chain, member: sneha, hops: 4, date: 19 Sep}, {kind: member_joined, member: arjun, date: 3 Sep}]

STATES
Default: as above.
Empty: "Nothing on the wall yet. Milestones show up here as your squad hits them, like a first Hard, a 7-day squad streak, or a finished goal." with a secondary "Set a squad goal".

INTERACTIONS
"Share" on a milestone opens a share sheet with a Pass-styled image. Entries with a problem link to the Problem Workspace (05); entries with a person link to their profile (22).
```

### 15 · Weekly Recaps Archive (`/squad/[id]/recaps`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Every week, the squad gets a frozen recap: what happened, who improved, and honestly what didn't happen. This archive lists them so a squad can look back on its run.

GOAL
Open last week's recap. The focal point is the latest recap, shown as a larger summary card at the top.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Squad / Recaps", dock idle). Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Heading row: title, one line, and a secondary "Write this week's recap" button (admin only).
2. Latest recap: a featured card.
3. Archive list: compact rows, newest first (reading width).

COMPONENT HIERARCHY
Heading: "Weekly recaps"; line "Frozen every Sunday night. Nothing gets back-filled."
Latest recap card
  - Title "5–11 October"
  - Headline (heading style): "27 solves and a 14-day streak. Prem cut Longest Substring by over 8 minutes."
  - Quiet stat line: "Solves 27 · Challenges 6 sent, 4 beaten · Approaches 5 · Stuck asks 2"
  - Actions: secondary "Open recap", ghost "Share"
Archive rows
  - "28 Sep – 4 Oct": "23 solves · Rahul's 10th approach", chevron
  - "21–27 Sep": "19 solves · Two pointers goal complete", chevron
  - "14–20 Sep": "12 solves · Season 01 started", chevron
  - "7–13 Sep": "8 solves · Arjun joined", chevron

DATA
recaps: [{week: 5–11 Oct, headline, solves: 27, challenges_sent: 6, challenges_completed: 4, approaches: 5, stuck: 2}, {28 Sep–4 Oct, 23}, {21–27 Sep, 19}, {14–20 Sep, 12}, {7–13 Sep, 8}]

STATES
Default: as above.
Empty: "Your first recap appears after your squad's first full week."
Generating: the button shows a spinner, "Writing this week's recap…".

INTERACTIONS
Rows and "Open recap" open the Single Frozen Recap (16). "Share" opens the share row (copy link, WhatsApp, Telegram, LinkedIn, X, Discord).
```

### 16 · Single Frozen Recap (`/squad/[id]/recaps/[recapId]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
One week of a squad, frozen and shareable. Members open it from a notification. Friends of members open it from a link in a group chat, so it must read well to someone who's never seen Mahayuddh, and invite them to start their own.

GOAL
Understand the week in ten seconds and feel good about it. The focal point is the headline plus the week's biggest improvement.

VIEWPORT
Desktop 1440 × 1024. When signed in, show the desktop shell (breadcrumb "Squad / Recaps / 5–11 Oct", dock hidden). Mobile 390 × 844. For signed-out visitors, a minimal top bar replaces the shell, with the wordmark and "Start your own squad".

LAYOUT ZONES
1. Heading block (reading width): squad name, week range, headline.
2. Biggest improvement: a wide card showing a before → after time.
3. The week in numbers: one quiet row of five figures.
4. What happened: entries list.
5. What didn't happen: an honest list.
6. Share row and close.

COMPONENT HIERARCHY
Heading block
  - "Kshatriya · 5–11 October 2026"
  - Headline (page title style): "27 solves and a 14-day streak."
Biggest improvement card
  - Avatar Prem, "Prem Sai", problem "Longest Substring Without Repeating Characters"
  - "23:40" struck through → "15:06" in the mono display style, "8m 34s faster", verified badge
The week in numbers (five inline figures, numeral style for numbers and caption labels): "27 solves", "6 challenges sent", "4 beaten", "5 approaches", "2 stuck asks"
What happened (heading)
  - "Priya solved 9, all verified, including her first Hard."
  - "Rahul's Course Schedule challenge passed through 3 people."
  - "Sneha's Two pointers approach was copied twice."
  - "The squad kept a 14-day streak alive."
What didn't happen (heading)
  - "Nobody touched Heaps."
  - "The sliding-window goal didn't move on Thursday or Friday."
Share row: Copy link, WhatsApp, Telegram, LinkedIn, X, Discord (icon buttons with labels on desktop)
Close (visitors only): "Practice with your own people." with a primary button "Start your squad"

DATA
recap: {squad: Kshatriya, week: 5–11 Oct 2026, headline, solves: 27, challenges_sent: 6, challenges_completed: 4, approaches: 5, stuck_requests: 2, biggest_improvement: {prem, problem: 3, from: 23:40, to: 15:06, verified}, entries: [...], empty: ["Nobody touched Heaps.", "Goal didn't move Thu/Fri"]}

STATES
Default: member view (no visitor close).
Visitor view: minimal top bar, plus the close section with "Start your squad".
Not found: "This recap doesn't exist or isn't public." with a ghost "Go to Mahayuddh".

INTERACTIONS
Share buttons copy or open the share intents. Problem and person names link through for members. "Start your squad" goes to sign-up (02).
```

### 17 · Season Summary (`/squad/[id]/seasons/[seasonId]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A season is a squad's multi-week campaign with one objective, here four weeks of graph problems. The summary is the closing chapter: did we hit it, who showed up, what improved. It's meant to be shared.

GOAL
See at a glance whether the objective was met, and by how much. The focal point is the objective result: "41 of 40 graph problems".

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Squad / Seasons / Season 01", dock hidden), or the visitor top bar when signed out. Mobile 390 × 844.

LAYOUT ZONES
1. Heading block (reading width): season name, dates, objective.
2. Objective result: a wide card with the big result.
3. Season numbers: one quiet row.
4. Biggest improvement.
5. Who practised: member rows with a solves bar.
6. Share row.

COMPONENT HIERARCHY
Heading block: "Season 01 — Graph War"; line "Kshatriya · 14 Sep – 11 Oct 2026"; objective line "Objective: 40 graph problems as a squad"
Objective result card
  - "41 of 40" in the large numeral style, "graph problems · objective met", with a thin full progress bar
  - Headline sentence: "Four weeks, 27 active days out of 28, and Graphs went from everyone's weakest pattern to Arjun's favorite."
Season numbers (inline figures): "112 solves", "64 problems", "18 challenges", "13 beaten", "21 approaches", "27 of 28 active days"
Biggest improvement: avatar Arjun, "Course Schedule", "38:50" struck through → "17:30", "21m 20s faster", verified badge
Who practised (heading): member rows with a thin bar proportional to solves
  - Priya 31 · Rahul 26 · Prem 24 · Sneha 18 · Arjun 13
Share row; a ghost "Back to squad"

DATA
season: {name: "Season 01 — Graph War", squad: Kshatriya, starts: 14 Sep, ends: 11 Oct, objective: {pattern: Graphs, target: 40, achieved: 41}, solves: 112, problems: 64, challenges: 18, answered: 13, approaches: 21, active_days: 27/28, biggest_improvement: {arjun, problem: Course Schedule, from: 38:50, to: 17:30, verified}, members: [{priya, 31}, {rahul, 26}, {prem, 24}, {sneha, 18}, {arjun, 13}]}

STATES
Default: completed season, objective met.
Objective missed: "34 of 40 · 6 short". The tone stays plain: "Close. Graphs is still the squad's most improved pattern." No failure styling.
In progress: "18 of 40 · 2 weeks left", and the share row is replaced by "Season ends 11 Oct".
Visitor: minimal top bar, plus a close inviting them to "Start your squad".

INTERACTIONS
Member rows open profiles (22). Share copies the link or opens share intents; the link preview uses the objective result composition.
```

**Build notes.** Seasons have no creation UI, and today this page is only
reachable from a share link. Add "Start a season" (admin) to the Squad
Hub rail.

---

## 5. Knowledge & Writing

### 18 · Notebook & Vault (`/notebook`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A developer's private study notebook: templates, mistakes they keep making, and interview notes. It also holds the shared vault of community cheat sheets, notes shared 1:1, and an impact view showing who your notes helped. Notes are private by default.

GOAL
Find and read your own note fast, and write a new one. The focal point is the note list beside the open note.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (active nav "Notebook", dock idle): two panes, the list on the left (about a third) and the open note on the right. Mobile 390 × 844 inside the mobile shell: the list first; tapping a note pushes to a full-screen reader with a back button.

LAYOUT ZONES
1. Heading row: title, underline tabs, a search field, and a primary "New note" button.
2. List pane: note rows with filter chips for patterns.
3. Note pane: title, meta, rendered markdown body, and actions.

COMPONENT HIERARCHY
Heading: "Notebook"; primary button "New note"
Tabs: "My notes 12" (active) · "Vault" · "Shared with me 3" · "Impact"
Search: "Search your notes"; filter chips: All · Sliding window · Graphs · Dynamic programming
List pane (rows; selected row on the overlay surface)
  - "Sliding window template" · chip "Sliding window" · "Private" · "edited 2d ago" (selected)
  - "Why my DP solutions TLE" · chip "Dynamic programming" · "Squad" · "5d ago"
  - "Graph BFS cheat sheet" · "Forked from @priya" · "Private" · "1w ago"
  - "Amazon onsite notes (Sep)" · "Private" · "3w ago"
  - "Union-find in 10 lines" · chip "Graphs" · "Public" · "1mo ago"
Note pane
  - Title (title style): "Sliding window template"
  - Meta row: chip "Sliding window", visibility "Private", linked problem "No. 3 Longest Substring…", "edited 2d ago"
  - Body (reading width): a short paragraph, then a code block (Python, about 12 lines of a two-pointer window template), then a bulleted "Watch out for" list of 3 items
  - Actions: secondary "Edit", ghost "Share 1:1", ghost overflow (Change visibility, Delete)

DATA
notes: [{title: "Sliding window template", pattern: Sliding window, visibility: private, problem: 3, edited: 2d}, {title: "Why my DP solutions TLE", visibility: squad, 5d}, {title: "Graph BFS cheat sheet", fork_from: priya, 1w}, {title: "Amazon onsite notes (Sep)", private, 3w}, {title: "Union-find in 10 lines", public, 1mo}] · counts: my 12, shared 3

STATES
Default: My notes with the first note open.
Editor: the note pane becomes a markdown editor (title field, body textarea in the code style for code fences, a preview toggle), visibility segmented control Private | Squad | Public, "Share 1:1 with" a username field, primary "Save".
Vault tab: rows "Sliding window template (Python)" · "Cheat sheet · by @priya" · ghost "Copy to my notebook"; filter chips Templates · Interview logs · Cheat sheets · Articles.
Shared with me: rows show "from @rahul" and "Read-only".
Impact tab: a headline "Your notes were copied 6 times." with rows like "Arjun copied 'Sliding window template' and solved Minimum Window Substring 3d later". Empty: "Nothing of yours has been copied yet. Public notes and approaches show up here when someone uses them."
Empty notebook: "Your notebook is empty. Notes are private unless you share them." with a primary "New note".

INTERACTIONS
"New note" opens the editor in the note pane. Rows open notes. "Share 1:1" opens a small popover to pick a squad mate. "Copy to my notebook" duplicates with "Forked from @x" and shows a toast with "Open".
```

**Build notes.** `/vault` redirects to `/notebook?tab=vault`, and the
"Open full vault" link loops back to the same place. Remove the link; the
Vault tab is the vault.

### 19 · Primers Index (`/primers`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Short, focused explainers for core DSA patterns, each readable in about ten minutes and ending with ordered starter problems. A developer comes here before practicing a pattern they don't feel solid on.

GOAL
Pick the primer that matters most for you right now. The focal point is the recommended primer for your weakest pattern, featured at the top.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Practice / Primers", dock idle). Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Heading row: title and one line.
2. Recommended primer: a featured card with the reason.
3. All primers: a list (not a grid of equal cards), one row per primer (reading width).

COMPONENT HIERARCHY
Heading: "Primers"; line "One pattern, ten minutes, then the problems that teach it."
Recommended card
  - Pattern chip "Graphs"; title "Graph BFS in 10 minutes"
  - Reason: "Graphs is your weakest pattern right now (an estimate from your history)."
  - Meta: "5 starter problems · 4 common mistakes · 10 min read"
  - Primary button "Read primer"
All primers (rows)
  - Chip "Sliding window" · "Sliding window in 8 minutes" · "6 starters · 4 mistakes" · status "Read · 3 of 6 starters solved"
  - Chip "Two pointers" · "Two pointers in 7 minutes" · "6 starters · 3 mistakes" · "Read · 6 of 6"
  - Chip "Stack" · "Monotonic stack in 9 minutes" · "5 starters · 3 mistakes" · "Not read"
  - Chip "Graphs" · "Graph BFS in 10 minutes" · "5 starters · 4 mistakes" · "Not read"
  - Chip "Dynamic programming" · "1-D DP in 12 minutes" · "6 starters · 5 mistakes" · "Not read"

DATA
recommended: {pattern: Graphs, title: "Graph BFS in 10 minutes", reason: weakest pattern (estimate), starters: 5, mistakes: 4, minutes: 10}
primers: [{Sliding window, 8 min, 6 starters, read, 3/6}, {Two pointers, 7 min, read, 6/6}, {Stack, 9 min, not read}, {Graph BFS, 10 min, not read}, {1-D DP, 12 min, not read}]

STATES
Default: as above.
No history yet: no reason line; the recommended card becomes "Start here: Two pointers in 7 minutes".
Loading: row skeletons.

INTERACTIONS
Rows and "Read primer" open the Primer Reader (20). The pattern chip opens the Pattern Hub (08).
```

**Build notes.** Seeded primers today are Sliding window, Two pointers,
Stack, and Graph BFS. "1-D DP" is illustrative; drop it if it isn't
seeded.

### 20 · Primer Reader (`/primers/[slug]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Reading a single primer: Sliding window in 8 minutes. This is a calm long-form reading surface, followed immediately by practice.

GOAL
Understand the pattern, then start the first starter problem without leaving the page. The focal point is the readable body column; the closing call to action is the next step.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Primers / Sliding window", dock hidden while reading). A sticky table of contents sits to the right of the reading column. Mobile 390 × 844 inside the mobile shell; the table of contents becomes a "Jump to" select at the top.

LAYOUT ZONES
1. Title block (reading width).
2. Body sections (reading width).
3. Sticky table of contents (desktop only, right).
4. Close: starter problems and the primary action.

COMPONENT HIERARCHY
Title block: pattern chip "Sliding window"; title (page title style) "Sliding window in 8 minutes"; meta "8 min read · 6 starter problems"; actions: ghost "Copy to my notebook", ghost "Share"
Section "Recognize it when" (heading), a numbered list:
  1. "The answer is a contiguous subarray or substring."
  2. "You can update the condition in O(1) when one element enters or leaves."
  3. "Brute force would check every start and end pair, which is O(n²)."
Section "Mental model": two short paragraphs (body-lg) about a window that grows on the right and shrinks on the left.
Section "Template": a code block (Python, about 14 lines) with a copy icon button
Section "Complexity": "Time O(n): each index enters and leaves once. Space O(k) for the window's state."
Section "Common mistakes": four short rows
Section "Starter problems": 6 problem rows in order, with status glyphs (2 verified, 1 self-reported, 3 empty); the next unsolved one is highlighted
Close: "Ready? Start with Permutation in String." primary button "Start battle"; ghost "Back to Sliding window hub"
Table of contents: Recognize it when · Mental model · Template · Complexity · Common mistakes · Starter problems, with the current section highlighted

DATA
primer: {slug: sliding-window, title: "Sliding window in 8 minutes", minutes: 8, recognize_when: [3 items], mental_model, template_md: Python, complexity, mistakes: [4], starters: [121, 3, 424, 567, 76, 239] with your status}

STATES
Default: as above.
Not found: "This primer doesn't exist or isn't public." with a ghost "All primers".
Private primer (squad-only): the Share action is hidden.

INTERACTIONS
Table-of-contents links smooth-scroll to sections. Copy on the template copies the code with a toast. "Start battle" starts the dock on the highlighted starter. "Copy to my notebook" creates a private note linked to this pattern.
```

### 21 · Approach Reader (`/approach/[id]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
One person's explanation of how they solved one problem, here Priya's approach to Longest Substring Without Repeating Characters. It's read by squad mates comparing notes, or by anyone if it's public. The code stays hidden until the reader chooses to reveal it.

GOAL
Understand Priya's core idea in two sentences, then decide whether to reveal the code. The focal point is the core idea.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Practice / Longest Substring… / Priya's approach", dock hidden), reading width centered. Mobile 390 × 844 inside the mobile shell.

LAYOUT ZONES
1. Author and problem header (reading width).
2. Core idea, the largest text block on the page.
3. Detail rows (Time, Space, Key detail, Edge cases, Mistakes).
4. Reveal code panel.
5. Next steps row.

COMPONENT HIERARCHY
Header: avatar Priya, "Priya Nair", "@priya", visibility "Squad", "9 Oct"; problem row (compact): "Longest Substring Without Repeating Characters", No. 3, Medium, chip "Sliding window"; her battle line "Solved in 12:58", verified badge
Core idea (body-lg): "Grow the right edge; when a repeat shows up, move left past the previous occurrence instead of shrinking one step at a time. Track the max width as you go."
Detail rows (label left, value right, separated by dividers)
  - "Time": "O(n)" in mono
  - "Space": "O(min(n, k))" in mono, where k is the charset size
  - "Key detail": "left = max(left, last[c] + 1). The max matters when the previous occurrence is already outside the window."
  - "Edge cases": "Empty string, all-same characters, the window at the very end."
  - "Mistakes": "First version moved left to last[c] without the +1 and double-counted."
Reveal code panel (collapsed): "Python · 14 lines", secondary "Reveal code"
Next steps row: secondary "Compare with 2 other approaches"; ghost "Copy to my notebook"; ghost "Challenge Priya"

DATA
approach: {author: priya, visibility: squad, date: 9 Oct, problem: 3, battle: 12:58 verified, pattern: Sliding window, core_idea, time: O(n), space: O(min(n,k)), key_detail, edge_cases, mistakes, code: {lang: Python, lines: 14}, fork_count: 2}

STATES
Default: code hidden.
Code revealed: a code block with line numbers and copy.
Reader hasn't attempted the problem: the reveal panel adds "You haven't attempted this yet", and the next steps lead with a primary "Start battle".
Owner view: adds a visibility segmented control (Private | Squad | Public) and a ghost "Delete" in an overflow menu.
Not found or private: "This approach doesn't exist or is private."

INTERACTIONS
"Reveal code" expands the code in place. "Compare with 2 other approaches" opens Compare (06). "Challenge Priya" opens Send Challenge (30) with "Beat 12:58" prefilled. "Copy to my notebook" forks it with attribution.
```

---

## 6. Public & Shareable

### 22 · Public Developer Portfolio (`/u/[username]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A developer's public page, here Priya's. People link to it from a resume, LinkedIn, or GitHub. It shows proof of practice and teaching, not vanity: verified solves, approaches others actually used, and consistency over time. Visitors may not have an account.

GOAL
Within a glance, believe that Priya practices consistently and teaches well. The focal point is the identity header beside her featured Proof card.

VIEWPORT
Desktop 1440 × 1024. Signed-out visitors see a minimal top bar (wordmark, "Sign in", "Start your squad"); signed-in viewers see the desktop shell. Mobile 390 × 844.

LAYOUT ZONES
1. Hero band: the identity block on the left (about 55%) and the featured Proof card on the right (about 45%). On mobile: identity, then the Proof card.
2. Five dimensions: a list of five rows, each with evidence.
3. Public work: underline tabs Approaches | Primers, with a list.
4. Footer: "Median solve 18:20 over the last 30 days" as a quiet line, and the visitor close.

COMPONENT HIERARCHY
Identity block
  - Large avatar, "Priya Nair" (page title style), "@priya · Kshatriya"
  - Line: "Often teaches Sliding window and Graphs."
  - Journey line: "88 battles, 71 verified solves across 9 patterns since August."
  - Actions: secondary "Follow"; ghost "Share"; (signed in, same squad) ghost "Challenge"
Featured Proof card (signature Pass, landscape, slightly smaller than full size)
  - Body: "Word Ladder", Hard, "44:10" in the mono display style, "First Hard · verified"
  - Stub: "@PRIYA", "08 OCT 2026", "NO. 127", verified seal
Five dimensions (rows; label, value, and a one-line evidence statement)
  - "Problem solving": "71 verified solves" · "9 Hard, 38 Medium, 24 Easy"
  - "Teaching": "14 public approaches" · "Copied 29 times"
  - "Helpfulness": "9 stuck requests answered" · "7 marked as unblocking"
  - "Consistency": "Active 52 of the last 60 days" · "Longest streak 31 days"
  - "Impact": "6 people solved a problem after reading her approach"
Public work tabs: "Approaches 14" (active) · "Primers 1"
  - Approach rows: problem, pattern chip, the first line of the core idea, "copied 4 times"
Footer line: "Median solve 18:20 over the last 30 days."
Visitor close: "Practice with your own people." with a primary button "Start your squad"

DATA
user: {name: Priya Nair, username: priya, squad: Kshatriya, teaches: [Sliding window, Graphs], battles: 88, verified_solves: 71, patterns: 9, since: Aug 2026, median_30d: 18:20}
featured_proof: {problem: 127 Word Ladder, Hard, time: 44:10, date: 8 Oct, verified, note: first Hard}
dimensions: {problem_solving: 71 (9H/38M/24E), teaching: 14 approaches / 29 copies, helpfulness: 9 answered / 7 accepted, consistency: 52 of 60 days / longest 31, impact: 6}

STATES
Default: visitor view.
Own profile view: adds a ghost "Edit profile" and a quiet "This is how others see your page."
New user with little data: dimensions with no data say "Not enough yet" instead of zero, and the featured card slot shows "No verified solves yet."
Not found: "No one here by that name."

INTERACTIONS
"Follow" toggles to "Following". "Share" copies the link; the preview image uses the identity plus featured Proof composition. Approach rows open the Approach Reader (21).

AVOID
No radar charts, power levels, tiers, badge walls, or contribution-graph clutter.
```

### 23 · Shareable Battle Proof Card (`/b/[id]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The page behind a shared Proof link. Someone posted it on X or LinkedIn, or dropped it in a group chat. Most viewers don't have an account. The Pass is the whole story, and it should look like a collector's card worth screenshotting.

GOAL
See the verified result instantly, then feel the pull to try it yourself. The focal point is the Verified Proof Pass, centered and large.

VIEWPORT
Desktop 1440 × 1024: the Pass at share scale, centered, with generous canvas around it. Mobile 390 × 844: the Pass in portrait form, filling the width.

LAYOUT ZONES
1. Minimal top bar: wordmark on the left; "Sign in" ghost on the right.
2. The Pass, centered.
3. Below the Pass: one stats line and the evidence sentence.
4. Visitor actions row.
5. Quiet footer.

COMPONENT HIERARCHY
Verified Proof Pass (signature Pass, landscape on desktop)
  Body
    - Problem title (display style): "Longest Substring Without Repeating Characters"
    - Meta row: difficulty badge Medium, pattern chip "Sliding window"
    - Hero: "15:06" in the mono display style
    - Improvement: "23:40" struck through, "→ 15:06 · 8m 34s faster", with a "Personal best" tag
    - Person line: avatar Prem, "Prem Sai · Kshatriya"
  Stub (mono serial lines)
    - "@PREM"
    - "10 OCT 2026"
    - "NO. 3"
    - Verified seal: a circle with a check and the word "VERIFIED"
Stats line (caption, quiet): "2 attempts · 1 revisit · challenged 3 · 2 friends solved it"
Evidence sentence: "Verified against an accepted LeetCode submission at 21:14 IST."
Visitor actions: primary button "Try this problem"; secondary "See it on LeetCode"; ghost "Share"
Footer: "Mahayuddh · Practice DSA with your people" with a "Start your squad" text link

DATA
battle: {user: prem, squad: Kshatriya, problem: {no: 3, title, difficulty: Medium, pattern: Sliding window}, duration: 15:06, previous_best: 23:40, delta: 8:34, personal_best: true, evidence: leetcode, verified_at: 10 Oct 2026 21:14 IST, attempts: 2, revisits: 1, challenged_out: 3, friends_solved: 2}

STATES
Default: verified.
Self-reported: no seal. The stub's last line reads "SELF-REPORTED", and the evidence sentence becomes "Logged by Prem without a LeetCode match."
First solve, no previous: the improvement line becomes "First timed solve".
Failed battle: not shareable (the page shows "This battle wasn't finished.").
Signed-in squad mate viewing: the primary becomes "Challenge Prem to beat 15:06".
Link preview image (1200 × 630): the Pass alone on the canvas, nothing else.

INTERACTIONS
"Try this problem" sends visitors to sign-up (02) with the problem queued as their first battle, and sends members to the Problem Workspace (05). The verified seal plays the stamp moment once on first load.
```

### 24 · Challenge Deep-Link (`/c/[id]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The page behind a challenge link sent in a chat or notification. The recipient may be signed in, signed out, or not yet a member. It's a friendly dare with a time to beat.

GOAL
Accept the challenge. The focal point is the 1v1 Challenge Pass, centered.

VIEWPORT
Desktop 1440 × 1024: the Pass centered at share scale, with a minimal top bar (signed in or not). Mobile 390 × 844: the Pass in portrait form.

LAYOUT ZONES
1. Minimal top bar.
2. The Challenge Pass, centered.
3. Chain line below the Pass (when the challenge was passed along).
4. Quiet footer.

COMPONENT HIERARCHY
1v1 Challenge Pass (signature Pass)
  Body
    - Avatar Rahul, "Rahul challenged you" (title style)
    - Problem: "Word Ladder", Hard, "No. 127", chip "Graphs"
    - Hero: "Beat 38:11" in the mono display style
    - Note: "Took me two tries. Think hard about the visited set."
    - Due: "Due Sunday, 18 October"
    - Actions: primary button large "Accept challenge"; ghost "Pass it on"
  Stub (mono serial lines): "FROM @RAHUL", "TO @PREM", "DUE 18 OCT", "OPEN"
Chain line: "Started by Prem → Rahul → you" with three small avatars and hop states (beaten, open)
Footer: "Mahayuddh · Practice DSA with your people"

DATA
challenge: {from: rahul, to: prem, problem: {no: 127, Word Ladder, Hard, Graphs}, beat: 38:11, note, due: 18 Oct, status: open, chain: [{prem → rahul, beaten}, {rahul → prem, open}]}

STATES
Default: signed in as the recipient, open.
Signed out: the primary reads "Sign in to accept"; a line below reads "New here? You can join and accept in under a minute."
Not the recipient: the primary reads "Solve it too", with "Beat 38:11" still shown.
Hidden note: "Rahul left a hint. It unlocks when you finish." with a lock icon.
Beaten: the stub status reads "BEATEN" and the body shows "You beat it · 31:02", verified badge.
Expired: the stub reads "EXPIRED", and the primary becomes a secondary "Try it anyway".
Not found: "This challenge doesn't exist or was withdrawn."

INTERACTIONS
"Accept challenge" starts a battle with "Beat 38:11" in the dock. "Pass it on" opens Send Challenge (30) with the problem and the time to beat.
```

### 25 · Squad Invite Page (`/squad/join/[code]`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
The page behind a squad invite link. A friend sent it with "join us". The visitor sees who's in the squad and what they're working on, then joins.

GOAL
Join Kshatriya. The focal point is the invite card with the squad's faces and the primary join action.

VIEWPORT
Desktop 1440 × 1024: the invite card centered, about 560 wide, with a minimal top bar. Mobile 390 × 844: the card full width.

LAYOUT ZONES
1. Minimal top bar.
2. Invite card, centered.
3. Quiet "what you get" lines below it.

COMPONENT HIERARCHY
Invite card
  - Avatar stack of all 5 members (larger avatars)
  - "Rahul invited you to" (body) then "Kshatriya" (page title style)
  - Description line: "Five friends from the 2024 batch, prepping for fall interviews. One problem a day."
  - Squad facts (three inline items): streak chip "14-day squad streak" · "Goal: sliding-window set, 7 of 10" · "5 members"
  - Primary button large "Join Kshatriya"
  - Invite code row: "Code KQ7X2P9M" in mono with a copy icon button
What you get (three short lines, quiet): "Today's problem, picked for your squad." / "See who solved it, how fast, and how they thought." / "Friendly 1v1 challenges, no wagers."

DATA
invite: {code: KQ7X2P9M, squad: Kshatriya, inviter: rahul, members: [prem, priya, rahul, arjun, sneha], description, squad_streak: 14, goal: {title: sliding-window set, done: 7, target: 10}}

STATES
Default: signed out; the primary reads "Join Kshatriya" and leads to Join (02) with the invite attached.
Signed in, not a member: the primary joins immediately and lands on the Squad Hub (13).
Already a member: "You're already in Kshatriya." with a secondary "Open squad".
Squad full (7 members): "Kshatriya is full. Ask Rahul about starting a second squad." with a secondary "Start your own squad".
Invalid code: "That invite code doesn't work. Check it with the person who sent it."
Loading: card skeleton.

INTERACTIONS
Copy code shows a toast. Joining shows a brief success state: "You're in. Today's battle is waiting." with a primary "Go to Arena".
```

---

## 7. Utility & Overlays

### 26 · Own Profile & Settings (`/profile`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Your own account page: a preview of how others see you, plus the settings that matter (LeetCode connection, practice objective, squads, notifications, and privacy defaults).

GOAL
Check how your public page looks and fix one setting. The focal point is the profile header with "View public page".

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (user card opened, breadcrumb "Profile", dock idle). Settings sections stack in a single reading-width column with a sticky section nav on the left. Mobile 390 × 844 inside the mobile shell, as a single column.

LAYOUT ZONES
1. Profile header.
2. Section nav (desktop): Account · LeetCode · Practice · Squads · Notifications · Privacy.
3. Settings sections in one column.

COMPONENT HIERARCHY
Profile header: large avatar, "Prem Sai", "@prem · Kshatriya", streak chip "23"; secondary "View public page"; ghost "Edit profile"
Section "Account": rows Name "Prem Sai" · Username "@prem" · Email "prem.sai@gmail.com", each with a ghost "Edit"
Section "LeetCode"
  - Connected row: "prem_sai_lc", "Synced 4m ago", secondary "Sync now", ghost "Disconnect"
  - Row: "Import full history", "Pull every accepted solve so your sheets start complete.", ghost "Import"
Section "Practice": "What are you practicing for?" filter chips Internship prep · Full-time roles (selected) · Daily consistency
Section "Squads": rows "Kshatriya · 5 members · Admin" with a ghost "Open"; a ghost "Join with code"
Section "Notifications": toggle rows "Push alerts on this device" (on), "New challenges" (on), "Squad goals" (on), "Revenge reminders" (on), "Weekly recaps" (on), "Contest reminders" (off)
Section "Privacy": "Default visibility for new approaches": segmented Private | Squad (selected) | Public; "Default for notes": Private (selected)
Footer: ghost "Sign out"; a danger-tinted text button "Delete account" (opens a confirmation dialog)

DATA
user: {name: Prem Sai, username: prem, email: prem.sai@gmail.com, squad: Kshatriya (admin), streak: 23, leetcode: {handle: prem_sai_lc, synced: 4m ago}, objective: Full-time roles, notifications: {push: on, challenge: on, goal: on, revenge: on, recap: on, contest: off}, defaults: {approach: squad, note: private}}

STATES
Default: as above.
LeetCode not connected: the section shows "Connect LeetCode to verify your solves. Everything works without it." with a username field and a secondary "Connect".
Sync failed: an inline error, "LeetCode didn't respond. Try again in a minute." with a retry.
Push not supported on this browser: the push toggle is disabled with a tooltip.

INTERACTIONS
Toggles save instantly with a quiet "Saved" caption. "View public page" opens /u/prem (22). "Sync now" shows a spinner, then updates the timestamp.
```

**Build notes.** `/profile` is a placeholder with two link cards today.
Notification kinds map to the existing `notifications.kind` values. The
history import uses the existing `/api/sync/leetcode-history` flow.

### 27 · Quality Gates (`/validation`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
An internal page for the team running Mahayuddh. It tracks whether the product clears its quality gates (activation, social, learning, retention, organic growth), logs observations from user sessions, and triages features. It's used weekly.

GOAL
See which gates pass, which fail, and which have no data yet, then log what you observed. The focal point is the gates summary list.

VIEWPORT
Desktop 1440 × 1024 inside the desktop shell (breadcrumb "Internal / Quality gates", dock hidden). Mobile 390 × 844 is supported but secondary.

LAYOUT ZONES
1. Heading row: title, one line, and "Updated 2h ago".
2. Gates list: five rows (reading width).
3. Two columns below: "Log an observation" form (left) and "Feature triage" list (right).

COMPONENT HIERARCHY
Heading: "Quality gates"; line "Each gate compares a measured rate with its target."
Gates list (rows: name, definition, current vs target, status)
  - "Activation" · "New members who finish a battle in their first session" · "64% / target 60%" · status "Passing" (neutral check)
  - "Social" · "Members who send a challenge in week one" · "31% / target 40%" · status "Failing" (error text)
  - "Learning" · "Solves followed by a written approach" · "28% / target 25%" · "Passing"
  - "Retention" · "Squads still active in week four" · "—" · "No data yet: needs 4 weeks"
  - "Organic" · "Sign-ups from shared links" · "22% / target 20%" · "Passing"
Log an observation (card)
  - Kind segmented control: Hesitation | Blocker | Ignored | Workaround
  - Fields: "Where" (page select), "What happened" (textarea)
  - Secondary button "Log observation"
Feature triage (card): rows "Squad streak · Build next", "Seasons create UI · Later", "Patterns index · Build next", "GitHub sign-in · Not now", each with a select

DATA
These are sample values for the mockup:
gates: [{activation, 0.64, target 0.60, pass}, {social, 0.31, 0.40, fail}, {learning, 0.28, 0.25, pass}, {retention, null, no_data}, {organic, 0.22, 0.20, pass}] · updated: 2h ago

STATES
Default: as above.
All gates no data (new deployment): "Gates need at least a week of activity." 

INTERACTIONS
Logging an observation adds it to a list below the form with a timestamp. Triage selects save instantly.

AVOID
Don't use the verified color for passing gates. It is reserved for verified solves; passing is a neutral check.
```

### 28 · Offline Notice (`/offline`)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Shown by the installed app when there's no connection, often on a phone during a commute.

GOAL
Understand what still works and get back fast. The focal point is the short message with a retry.

VIEWPORT
Mobile 390 × 844 first (no shell, minimal top bar with the wordmark). Desktop 1440 × 1024: the same content centered.

LAYOUT ZONES
1. Minimal top bar.
2. Centered message block.

COMPONENT HIERARCHY
Icon: a wifi-off line icon
Heading (title style): "You're offline"
Body: "This page needs a connection. A battle timer that's already running keeps counting on this device."
Primary button "Try again"; ghost "Back to Arena"

DATA
none

STATES
Default: as above.
Back online: a toast "You're back online" and an automatic return to the previous page.

INTERACTIONS
"Try again" reloads. "Back to Arena" opens /home from the cache if available.
```

### 29 · Post to Feed Modal

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Opened from the Feed composer row. A member shares something with their squad or everyone: a solve, a lesson, a challenge, a stuck request, a resource, or a discussion. Every post type is grounded in real activity (a battle, an approach, a vault item), not free-floating status updates.

GOAL
Share a solve in three clicks. The focal point is the selected post type's picker plus a live preview.

VIEWPORT
Desktop 1440 × 1024: the modal is about 560 wide, centered over the scrimmed Feed. Mobile 390 × 844: a bottom sheet at near full height.

LAYOUT ZONES
1. Modal header: title and close.
2. Post type selector: six compact options in a 3 × 2 grid of small selectable tiles (icon plus label only, no descriptions).
3. Picker for the selected type.
4. Caption field.
5. Audience and preview.
6. Footer actions.

COMPONENT HIERARCHY
Header: "Post to feed"; close icon button
Type tiles: "Share a solve" (selected) · "Teach" · "Challenge" · "Ask for help" · "Share a resource" · "Start a discussion"
Picker "Pick a battle" (list of your recent finished battles, radio rows)
  - "Coin Change II · 16:05 · Verified · today" (selected)
  - "Longest Substring Without Repeating Characters · 15:06 · Verified · Sat"
  - "Two Sum · 02:58 · Verified · Thu"
Caption: textarea "Add a line (optional)", with text "Finally saw why the loop order matters."
Audience: segmented control "Squad" (selected) | "Everyone"
Preview: a feed item as it will appear: "Prem solved Coin Change II in 16:05" with a verified badge and the caption
Footer: ghost "Cancel"; primary button "Post"

DATA
recent_battles: [{518 Coin Change II, 16:05, verified, today}, {3 Longest Substring…, 15:06, verified, Sat}, {1 Two Sum, 02:58, verified, Thu}] · caption · audience: squad

STATES
Default: Share a solve.
Teach: pick one of your public approaches or primers.
Challenge: pick a squad mate, a problem, and a time to beat (hands off to 30's fields).
Ask for help: pick a problem and a ladder level (Nudge to Full explanation).
Share a resource: pick a vault item.
Start a discussion: problem (optional), pattern tags, and a body; audience Squad | Everyone.
Empty picker: e.g. "No finished battles yet. Solve one and share it here." with a ghost "Go to today's battle".
Posting: the primary shows a spinner; on success the modal closes and the new item appears at the top of the feed with a toast.

INTERACTIONS
Switching type keeps the caption. Esc closes unless the caption has text, in which case it asks "Discard this post?". "Post" is disabled until a required pick is made.
```

### 30 · Send Challenge Modal

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
Opened from a battle result ("Challenge someone"), a profile, the leaderboard, or Challenges. Prem just solved Coin Change II in 16:05 and wants Arjun to try to beat it.

GOAL
Send a friendly 1v1 in under ten seconds. The focal point is the live Challenge Pass preview that updates as you fill the form.

VIEWPORT
Desktop 1440 × 1024: the modal is about 720 wide, with the form on the left and the live Pass preview on the right. Mobile 390 × 844: a bottom sheet with the form first and a compact preview at the top.

LAYOUT ZONES
1. Header: title and close.
2. Form column.
3. Preview column (desktop) or preview strip (mobile).
4. Footer actions.

COMPONENT HIERARCHY
Header: "Challenge someone"; close icon button
Form
  - "To": a member select with avatars showing "Arjun Mehta · @arjun" (selected); options list all squad mates with "hasn't solved this" or "solved in 22:05" hints
  - "Problem": prefilled problem row "Coin Change II · No. 518 · Medium" with a ghost "Change"
  - "Time to beat": a toggle "Beat my time" (on) with a mono time field "16:05" and a caption "Your latest on this problem"
  - "Note (optional)": textarea "Hint, encouragement, or nothing." with text "Order of the loops is the whole problem."
  - Checkbox "Hide the note until they finish"
  - "Due": a date field defaulting to "Mon 19 Oct" (one week)
Preview: the 1v1 Challenge Pass at reduced scale. Body: "Prem challenged you", "Coin Change II", "Beat 16:05", the note (or the lock line if hidden). Stub: "FROM @PREM", "TO @ARJUN", "DUE 19 OCT", "OPEN"
Footer: ghost "Cancel"; primary button "Send challenge"

DATA
from: prem · to: arjun · problem: {no: 518, Coin Change II, Medium} · beat: 16:05 (from your latest battle) · note · spoiler: true · due: 19 Oct

STATES
Default: as above.
No time to beat: with the toggle off, the preview hero reads "Solve it" instead of a time.
Duplicate guard: if Arjun already has an open challenge from you on this problem, a form alert reads "Arjun already has this challenge from you (sent Sat)." with a ghost "View it".
Pass it on mode (forwarding a challenge): the title becomes "Pass it on"; the problem is locked; "Time to beat" defaults to your finish time.
Sent: the modal closes with a toast "Challenge sent to Arjun" and a "Copy link" action.

INTERACTIONS
Every field updates the preview live. Enter in the note doesn't submit. ⌘Enter submits.
```

**Build notes.** The modal's fields map one-to-one to `suggestions`:
`to_user`, `problem_title`/slug, `difficulty`, `note`, `beat_time`,
`spoiler`, `deadline_at`, and `parent_id` for pass-it-on.

### 31 · Warrior Dossier Modal (quick profile)

```text
Apply the Mahayuddh design system from DESIGN.md for every color, type style, spacing value, radius, and component; introduce no new colors or fonts.

CONTEXT
A quick-look profile that opens over the current page when you click a squad mate in the leaderboard, sidebar, or feed. It answers "how is Rahul doing?" without leaving what you were doing.

GOAL
Get the picture of Rahul's practice in five seconds, then challenge him or open his full profile. The focal point is the header with his streak and the primary "Challenge Rahul" action.

VIEWPORT
Desktop 1440 × 1024: the modal is about 560 wide over the scrimmed Leaderboard. Mobile 390 × 844: a bottom sheet.

LAYOUT ZONES
1. Header: identity and primary action.
2. Practice summary: one row of four plain figures.
3. Patterns: strongest and needs work.
4. Recent verified solves: three rows.
5. Footer links.

COMPONENT HIERARCHY
Header: avatar, "Rahul Verma", "@rahul · Kshatriya", streak chip "19"; primary button "Challenge Rahul"; close icon button
Practice summary (four figures, numeral style with caption labels): "118 solved" · "61 Easy · 48 Medium · 9 Hard" (one combined caption under it) · "1,642 contest rating" · "Top 12% · 14 contests"
Source line (caption): "From LeetCode · synced 2h ago"
Patterns: two short rows. "Strongest: Graphs, Two pointers" (pattern chips) and "Needs work: Dynamic programming", with a caption "An estimate from his battles."
Recent verified solves (rows with verified badges)
  - "Coin Change II · 19:47 · today"
  - "Word Ladder · 38:11 · Thu"
  - "Course Schedule · 21:05 · last week"
Footer: ghost "View full profile"; ghost "Share"

DATA
member: {name: Rahul Verma, username: rahul, squad: Kshatriya, streak: 19, solved: {easy: 61, medium: 48, hard: 9, total: 118}, contest: {rating: 1642, attended: 14, top_pct: 12}, synced: 2h ago, strongest: [Graphs, Two pointers], weakest: [Dynamic programming], recent_verified: [{518, 19:47, today}, {127, 38:11, Thu}, {207, 21:05, last week}]}

STATES
Default: another member.
Your own dossier: the primary becomes secondary "View public page", and the source line adds a ghost "Sync now".
Not linked to LeetCode: the summary shows Mahayuddh-only numbers ("42 verified battles here") and "Contest rating not available".
Loading: skeleton.

INTERACTIONS
"Challenge Rahul" opens Send Challenge (30) prefilled with Rahul. Pattern chips open Pattern Hubs (08). Solve rows open the Battle Proof page (23).

AVOID
No power level, rank tiers (Unrated Prospect, Grandmaster…), achievements (Hard Slayer, Consistency Titan…), combat radar, or energy rings.
```

**Build notes.** The current Dossier contradicts the product's "no XP,
no badges" promise. It has a "Power Level", rating tiers, four
achievements, and a six-axis "Combat Radar". It also has two data bugs:
`userCalendarJson` is never passed in, so the 7-day pulse is always empty
and Max Streak equals Current Streak; and `statusMap` isn't passed from
the sidebar or leaderboard, so the radar is empty there. This redesign
removes all of it. The screen keeps its name in this catalog only.

---

## 8. Generation Tracker

Update this table as screens are generated and approved in Stitch.

| # | Screen | Desktop | Mobile | Stitch screen IDs | Notes |
|---|---|---|---|---|---|
| S1 | Desktop Application Shell | generated | n/a | desktop 7c91948021fd45aba7d96292095b1b94 (session 5833172712807646840) | |
| S2 | Mobile Companion Shell | n/a | generated | mobile d75d2395c3834e5e8d3fb7fdaf0fc31d (session 15026007495740769046) | |
| S3 | Global Search Modal (⌘K) | generated | generated | desktop 8cd3d6b001b94f83aafb78b1d8acb866 (session 13071896093253327755), mobile a850157ce4e7418da5c38df52a607e8e (session 5373075206788243578) | |
| 01 | Landing Page | generated | generated | desktop 9089e33c394642969e4131a409c43256 (session 7585988737394973237), mobile 2fb5e71c36f74072a6129fc7819f6afe (session 14349963864542080864) | |
| 02 | Sign In / Join Squad | generated | generated | desktop 7fa9c4ff29a547f9a024050c73d6f4e2, mobile 89f335a849564d859f0ebca45aeb8429 (session 6521664757240292004, both in one call) | |
| 03 | Arena — Daily Hub | generated | generated | desktop 70cd02273991435b9df122514ce41da7 (+refine 03e917c72cd14a2386899a2b263be14d), mobile 52561697e5354a82aa0f6199611efa83 | Generate first |
| 04 | Practice Hub — Review Queue | generated | generated | desktop 14b5ae90b6d64add8ca348733712e28e, mobile 1b339e362c354ea7962a716c0d2b4c1a (session 8308307112677651824, both in one call) | |
| 05 | Problem Workspace | generated | generated | desktop 4b471bf05fb44eabba13f53092e8f0e9 (session 14647657372331536543), mobile 970dd6e94fbd44cab7095f4eebacac6f (session 600078936906121487) | |
| 06 | Compare Squad Approaches | generated | generated | desktop acbce83dcf3a481d82fe6d0e7b71c64e, mobile 43be8548099e4561a8bed7779b134311 (session 11709819309414878445, both in one call) | |
| 07 | Roadmap Matrix | generated | generated | desktop 692dd438363e4ef39a216d2353f7ed59 (session 14831282769094240360), mobile 45922105d7b74673af96090251acb52e (session 1795582551237224693) | |
| 08 | Pattern Hub | generated | generated | desktop 26f72ecdfb2a451282bfcb1ba4fe62e7, mobile e31999d7f9f3457c8616f900b3bc1f11 (session 9230576711293160310, both in one call) | |
| 09 | Stuck Ladder | generated | generated | desktop 72388b946e5b49999a71669ce6338db4, mobile d0688aa0a42a4d01a8bf9982deab411a (session 7833335149638769851, both in one call) | |
| 10 | Squad Activity Feed | generated | generated | desktop 65e090c1124f4b75909c8d61ef970934, mobile 45ff7ae02c3448f4889fad5443a14fab (session 13915326568530715896, both in one call) | |
| 11 | Suggestion Box & Duels | generated | generated | desktop e79d330734d7454ca9d83448990d886e, mobile 18a93793a6d344b09e6ebfca16a19e28 (session 9901442674692498581, both in one call) | |
| 12 | Leaderboard | generated | generated | desktop c027ea815797417faaf0e3c51807bb1c, mobile 18ccdad6a17343e2a32c65cbb53d5de0 (session 16132164188189839124, both in one call) | |
| 13 | Squad Hub | generated | generated | desktop 5cbe62080a594781918f42f0b69e3dbd, mobile e8b26ae415c14c29bebed512aa28002c (session 3885632894221437747, both in one call) | |
| 14 | Squad Wall | generated | generated | desktop 616b433b12d24da4b6bc7fbc4ed6f0db, mobile 86b413c76709477fb7c94edd52d3b43a (session 4355924875422406410, both in one call) | |
| 15 | Weekly Recaps Archive | generated | generated | desktop bf23ad5b9d3f4d8ab519446e3ffb5693, mobile 2b455f9b6e8a43f0a333a52afae31f47 (session 8236204022850523388, both in one call) | |
| 16 | Single Frozen Recap | generated | generated | desktop f12990f755cf4fc1b57b18d8b6ff97e0 (session 15130523629054982794), mobile c490440746da4b85aa2ecbe86bc1a9d0 (session 1543727560640123359) | |
| 17 | Season Summary | generated | generated | desktop fb893af4407948b780e449b446c6cb96 (session 3422457809301668232), mobile a35a5d20bf11429ab3c82e426bf86c85 (session 5665944903225824149) | |
| 18 | Notebook & Vault | generated | generated | desktop 3cee32fa438d4593a71ad1465734e2f3, mobile 6d08f608fae64e5abafb3e85ec5f52a3 (session 4026680220152754898, both in one call) | |
| 19 | Primers Index | generated | generated | desktop 2aee7a11f35141fb9416ee7673fbcbe0, mobile 387b9b6915d94c4f91480e06fd53500a (session 17115450030640948369, both in one call) | |
| 20 | Primer Reader | generated | generated | desktop 5d6e5a7cd0684b839843e2d74ad8cdc6, mobile 0a4aa49528ed41efb553df4d6e26b7cf (session 9700413984013932488, both in one call) | |
| 21 | Approach Reader | generated | generated | desktop 722a9ca01a1740d391536bd71a351f67, mobile 91a7e5cafdda4d6aa7178f861319fd8e (session 11385080291814703882, both in one call) | |
| 22 | Public Developer Portfolio | generated | generated | desktop 4a91ab341ebc484f87eef7838daacae3 (session 7786384551281720283), mobile 9c29b229839643199956dfcea1f84eb7 (session 5689409865227315677) | |
| 23 | Shareable Battle Proof Card | generated | generated | desktop 84621ef400e642c88a7c6a2a5541a16a (session 7007937777001674698), mobile c6ebde968202478f9ed91b2960d5273b (session 4681185151892506543) | |
| 24 | Challenge Deep-Link | generated | generated | desktop 136e33168c8c48dd97fdbf2354e1444b (session 9883038478727277093), mobile f8d7abe29f814f2e80d0ccf485b10d0b (session 12810309186272399985) | |
| 25 | Squad Invite Page | generated | generated | desktop 13d5ad7f8b824736bbb36d79d3f9064a (session 6180754982560511881), mobile dbb8ccb7ce3f49188345781fc4f51bcf (session 10335958586202526416) | |
| 26 | Own Profile & Settings | generated | generated | desktop eab42be874cb484397c164f36c58fe68, mobile 75b19795ab444c43b8d64ef30e85a61a (session 5205090784492812173, both in one call) | |
| 27 | Quality Gates | generated | generated | desktop 1ef455e567ec4f12a4b8e4c62e5a7279 (session 1559465295636840313), mobile 7a2d95c5d04e4520a0c74b81bffea8a1 (session 17289503830953150229) | |
| 28 | Offline Notice | generated | generated | desktop 0f5781da9eff42e986f87920bb5b20a2 (session 1117746339471006020), mobile ceda26b85e1d4e549fc8e59cd3da985b (session 3077495841512825903) | |
| 29 | Post to Feed Modal | generated | generated | desktop f6f6da09973a4f35832015becdeaaeb4, mobile d811c3e4054f43bb8e9ad8e2f5a15dcf (session 17894309837003458941, both in one call) | |
| 30 | Send Challenge Modal | generated | generated | desktop cd4f3139e2b8451b8ba3c1333275702e (session 14947418599060714227), mobile 230bccf8c74746efa3336d1cec868fd6 (session 15678302337742626413) | |
| 31 | Warrior Dossier Modal | generated | generated | desktop 07941a8299a44e11bfbe25f7b818f97b, mobile f8fc738ad8364af0b9e2b51fd4daa053 (session 10723736035952764209, both in one call) | |

Status key: — not started · generated · approved.
