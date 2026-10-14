# Mahayuddh — Product Operating System
## Product Bible v2 — Source of Truth

**Status:** Product strategy / build specification  
**Date:** 2026-09-30  
**Purpose:** Turn Mahayuddh from a collection of DSA utilities into a coherent social learning product that people return to because their practice, friends, progress, and knowledge live in one place.

---

# 0. Executive Thesis

Mahayuddh is a social practice platform for developers preparing for technical interviews.

It is **not** another coding judge, another roadmap, another Notion clone, or another generic developer social network.

LeetCode already provides the problem bank and judging layer. NeetCode and similar resources provide curated learning paths and explanations. Mahayuddh's job is to own the layer around actual practice:

> **Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return**

The existing product already contains most of the raw infrastructure for this:
- LeetCode problem catalog and curated sheets
- solved / attempted tracking
- leaderboard
- asynchronous challenges
- Now-Solving timer + scratchpad
- LeetCode sync / proof machinery
- Vault / shared resources
- squad architecture in progress

The strategy is therefore **not to throw away the current app**.

The strategy is to connect the existing pieces into one behavioral system.

## The central product promise

> **Practice DSA with your people. Learn how they think. Prove what you can do. Challenge them. Get better together.**

## The central product insight

A solved problem should not be the end of an interaction.

It should become an object that can generate:
- an explanation,
- a challenge,
- a comparison,
- a revision,
- a learning artifact,
- a social post,
- and eventually a visible record of improvement.

---

# 1. Product North Star

## North-star behavior

A healthy Mahayuddh user repeatedly:

1. chooses a meaningful problem,
2. starts a real solving session,
3. independently attempts it,
4. gets proof of the result,
5. records or communicates their thinking,
6. interacts with another developer around the problem,
7. learns something,
8. returns for another battle.

The north star is **not registrations**.

The north star is **repeated social learning through actual problem solving**.

## What Mahayuddh should make users say

The ideal qualitative outcome is:

> “This is where my friends and I do DSA.”

Not:

> “This is a cool DSA dashboard.”

The first implies habit and identity. The second implies a tool that can be replaced.

---

# 2. Product Principles

## Principle 1 — Behavior over feature count

Every feature must create, improve, or reinforce a meaningful behavior.

A feature that merely adds a screen is suspect.

## Principle 2 — Founder ideas are hypotheses, not requirements

When a founder suggests “feed,” “chat,” “leaderboard,” “notes,” etc., the agent must first identify:
- user problem,
- target user,
- expected behavior,
- relation to the core loop,
- alternative solutions,
- cost / complexity,
- failure mode,
- measurable success criterion.

Do not convert every brainstorm into a permanent feature.

## Principle 3 — Social mechanics must improve learning

Competition is useful when it gets people to practice.

Social interaction that creates noise without improving practice is not automatically valuable.

## Principle 4 — Proof over vanity

Prefer signals tied to learning:
- solved,
- revisited,
- explained,
- challenged,
- completed,
- forked / copied,
- improved time,
- pattern mastery.

Likes and follower counts can exist, but should not define competence.

## Principle 5 — Async by default

Students do not have identical schedules.

The product should work when people practice at different times.

Realtime collaboration is not a product goal.

## Principle 6 — Private first, explicit sharing

Personal notes, attempts, and learning history should be private by default.

Sharing must be intentional and reversible.

## Principle 7 — Use LeetCode; do not become LeetCode

Mahayuddh does not need to own:
- the entire question bank,
- the online judge,
- a giant solutions database.

The product owns the social and learning graph around those problems.

## Principle 8 — No game UI slop

The “battle” metaphor should create identity without becoming childish:
- no excessive XP economy,
- no meaningless badges everywhere,
- no casino-style animation,
- no weapon skins,
- no clutter.

Use restrained vocabulary and motion.

## Principle 9 — Every important action should have a next action

Examples:

Solved → Explain  
Explained → Challenge  
Challenge completed → Compare  
Failed → Revenge  
Stuck → Ask for help  
Primer read → Start battle  
Resource copied → Practice

Never strand the user after an action.

---

# 3. The Mahayuddh Learning Graph

Mahayuddh should be understood as a graph rather than a collection of pages.

```text
                    ┌──────────────┐
                    │    PERSON    │
                    └──────┬───────┘
                           │
                follows / squads / friends
                           │
                           ▼
                    ┌──────────────┐
                    │    PATTERN   │
                    └──────┬───────┘
                           │
                     organizes
                           │
                           ▼
                    ┌──────────────┐
                    │    PROBLEM   │
                    └──────┬───────┘
                           │
                  learn / attempt / solve
                           │
                           ▼
                    ┌──────────────┐
                    │    BATTLE    │
                    └──────┬───────┘
                           │
                         proof
                           │
                           ▼
                    ┌──────────────┐
                    │   APPROACH   │
                    └──────┬───────┘
                           │
                share / fork / compare
                           │
                           ▼
             ┌────────────────────────────┐
             │       OTHER PEOPLE         │
             └───────┬──────────┬─────────┘
                     │          │
                 challenge     help
                     │          │
                     ▼          ▼
                 ┌───────┐  ┌────────┐
                 │DUEL / │  │  STUCK │
                 │CHAIN  │  │ LADDER │
                 └───┬───┘  └───┬────┘
                     │          │
                     └────┬─────┘
                          ▼
                    ┌──────────────┐
                    │   IMPROVE    │
                    │ pattern/time │
                    │ revision     │
                    └──────┬───────┘
                           │
                           ▼
                      NEXT BATTLE
```

The long-term moat is not an individual feature.

It is the **connected history of problems, people, patterns, approaches, challenges, and improvement**.

---

# 4. Core Product Loops

## 4.1 Primary loop — The Battle Loop

```text
Discover problem
      ↓
Understand pattern / primer
      ↓
Start Now-Solving
      ↓
Think + code + scratchpad
      ↓
Solve / fail
      ↓
Record outcome
      ↓
Explain approach
      ↓
Challenge someone
      ↓
Friend attempts
      ↓
Compare / discuss
      ↓
Revisit
      ↓
Improvement
      ↓
Next battle
```

This is the most important loop in the product.

If this loop is weak, more feed features will not save Mahayuddh.

---

## 4.2 Secondary loop — The Squad Loop

```text
Create / join squad
      ↓
Set squad goal
      ↓
Daily / weekly battle
      ↓
Members practice asynchronously
      ↓
Feed records activity
      ↓
Challenge each other
      ↓
Squad recap
      ↓
New goal / new season
```

The squad's job is to create **social accountability and shared identity**.

---

## 4.3 Knowledge loop

```text
Discover primer / approach
      ↓
Read
      ↓
Copy / fork
      ↓
Apply to problem
      ↓
Solve
      ↓
Write improved understanding
      ↓
Share
      ↓
Someone else learns
```

The important action is not saving content.

It is **turning content into practice**.

---

## 4.4 Community loop

```text
Good developer solves / understands something
      ↓
Publishes primer / approach / resource
      ↓
Other developers discover it
      ↓
Copy to notebook
      ↓
Practice
      ↓
Complete
      ↓
Original author gets attribution + meaningful proof
      ↓
Author's reputation grows
```

The community should reward **usefulness**, not posting frequency.

---

# 5. Existing Product → Product Role

The current app already has a meaningful foundation. Each component needs an explicit job.

| Existing feature | Product role |
|---|---|
| Problem catalog | Source of battles |
| NeetCode / Blind 75 / Striver sheets | Guided curriculum |
| User progress tracker | Personal memory |
| Now-Solving dock | Practice engine |
| Timer | Focus + proof |
| Scratchpad | Thinking capture |
| LeetCode sync | External verification |
| Leaderboard | Accountability |
| Challenge | Social activation |
| Vault | Shared resources / knowledge |
| Squad | Social unit |
| Feed | Activity stream |
| Global community | Discovery |
| Contest reminders | Recurring ritual |
| Profile / dossier | Learning identity |
| Share cards | Distribution |

The agent must never treat these as independent apps.

They are components of one system.

---

# 6. The Daily Battle

The daily battle should become the clearest entry point into the product.

## Concept

Every user should have an obvious “what do I do now?” answer.

Example:

### TODAY'S BATTLE

**Longest Substring Without Repeating Characters**

Medium  
Sliding Window

Why this problem:
> You have low recent exposure to Sliding Window.

Your squad:
> 4 / 7 have attempted it.

Personal:
> Previous best: 31:22

Primary CTA:

**START BATTLE**

After solve:

> Solved in 24:17.

Next actions:
- Explain your approach
- Challenge a friend
- Revisit later
- Share result

## Rules

One obvious primary CTA.

Do not expose ten competing CTAs on the dashboard.

---

# 7. Battle Cards

A Battle Card is a canonical artifact generated around a meaningful solve.

## Example

### ⚔️ TWO SUM

Easy · Arrays / Hashing

**Solved:** 14:23  
**Previous best:** 19:41  
**Pattern:** Hashing  
**Attempts:** 2  
**Revisits:** 1  
**Challenges:** 3  
**Friends completed:** 2

**My approach**
> Use a hash map to store previously seen values and look up the complement while traversing.

Actions:
- Challenge someone
- Share
- Revisit
- Add approach to notebook
- Compare squad approaches

## Why this matters

A Battle Card is:
- a personal learning artifact,
- a social object,
- a shareable artifact,
- a source of feed activity,
- a historical record.

It should become one of the defining Mahayuddh UI objects.

---

# 8. Challenge System

The existing async challenge is a core primitive and should remain asynchronous.

Definition:

> **I solved X → I challenge you to solve X.**

## Challenge anatomy

A challenge should include:
- problem,
- difficulty,
- target,
- sender's solve time if meaningful,
- optional message,
- optional “beat my time” goal,
- optional deadline,
- no spoiler by default.

Example:

> **Rahul challenged you**
>
> LRU Cache  
> Medium
>
> Rahul solved it in 21:43.
>
> “Try to beat this.”
>
> **ACCEPT CHALLENGE**

## Challenge actions

Accept  
Decline  
Remind  
Complete  
Pass the challenge  
Challenge another person

---

# 9. Beat My Time

This should be a lightweight extension of the challenge.

Instead of:

> Solve LRU Cache.

A challenge can say:

> Rahul solved LRU Cache in **21:43**.
>
> **Can you beat 21:43?**

The target is not worth points.

The target is a personal / social benchmark.

This makes the existing timer more meaningful.

---

# 10. Challenge Chains

A completed challenge can continue.

```text
Prem
  ↓ challenges
Rahul
  ↓ passes
Arjun
  ↓ passes
Sandeep
```

Display:

> **Challenge Chain — LRU Cache**

This can become a memorable squad ritual.

Possible states:
- active,
- completed,
- broken,
- timed out.

Do not add betting or wagers.

---

# 11. Revenge

Failed problems should have history.

Example:

> **REVENGE AVAILABLE**
>
> Trapping Rain Water
>
> Previous attempt: 41:06 — Failed
>
> Last attempt: 19 days ago
>
> **TAKE REVENGE**

Success:

> **REVENGE COMPLETE**
>
> Previous: Failed at 41:06  
> Current: Solved at 28:11

This creates an emotional reason to revisit failed problems.

---

# 12. “I'm Stuck” System

This should become a first-class action in the solving dock.

When stuck:

### I'M STUCK

Choose:

**Nudge**  
I only want a small clue.

**Pattern hint**  
Remind me what concepts might apply.

**Direction**  
Point me toward an approach.

**Full explanation**  
I accept the spoiler.

## No-spoiler culture

Other users should be able to respond at the same level.

For example:

> “Think about what remains monotonic when the window moves.”

That is more useful than dumping code.

## Future AI extension

AI can follow exactly the same ladder.

The product should not optimize for “fastest route to answer.”

It should optimize for “least help required to continue thinking.”

---

# 13. Approach Sharing

A solved problem can optionally become an “Approach.”

An approach should capture:
- core idea,
- pattern,
- complexity,
- key implementation detail,
- edge cases,
- mistakes,
- optional code,
- related problems.

The product vision distinguishes:
- Primer = before,
- Attempt = during,
- Approach = after.

Keep that distinction.

---

# 14. Primer System

Primers are the “learn before battle” layer.

## Primer template

### Pattern

Sliding Window

### Recognize it when

1. The problem works over a contiguous range.
2. A left/right boundary moves.
3. You maintain a constraint or property over the window.

### Mental model

```text
left → [ current window ] ← right
```

### Template

Language-agnostic explanation + optional code.

### Complexity

Typical time / space.

### Common mistakes

3–5 concise mistakes.

### Starter problems

3 linked problems.

### Start battling

**START PROBLEMS**

## Design constraint

Primers should be skimmable.

They are not textbooks.

Target:
- 5–10 minutes,
- one concept,
- immediately usable.

---

# 15. Three Knowledge Objects

The product should clearly distinguish these.

## Primer

**Before solving**

Teaches the pattern.

## Attempt

**During solving**

Private scratchpad / thinking.

## Approach

**After solving**

Clean explanation of what worked.

This avoids turning the notebook into a generic document editor.

---

# 16. Notebook / Vault Architecture

## Vault

Shared / reusable resources.

Examples:
- interview guides,
- cheat sheets,
- curated articles,
- links,
- templates.

## Notebook

Personal knowledge.

Organized using:
- folders,
- pattern tags,
- problem links.

## Sharing

Three visibility levels:

**Private**

Only owner.

**Squad**

Visible to members of selected squad.

**Public**

Discoverable by the community.

## 1:1 sharing

Specific-user shares can exist without publishing publicly.

## Core action

> **COPY TO MY NOTEBOOK**

Copying should preserve attribution.

Example:

> Forked from @prem

The copied version becomes private/editable by default.

---

# 17. Community Knowledge Graph

The community should not simply be a list of posts.

A pattern should have connected resources.

Example:

```text
Sliding Window
│
├── Primer
├── Starter Problems
├── Community Approaches
├── Common Mistakes
├── Recommended Videos
├── Recommended Articles
├── Questions
└── People who teach it
```

A problem should also connect to:

```text
Problem
│
├── Pattern
├── Attempts
├── Approaches
├── Challenges
├── Squad activity
├── Community discussion
└── Revisions
```

This is the long-term information architecture.

---

# 18. Social Feed

The feed is **not** “LinkedIn for developers.”

It is an activity surface generated by learning.

## Structured activity types

### Solve

> Prem solved 3Sum in 26m.

### Teach

> Ananya shared a Sliding Window primer.

### Challenge

> Rahul challenged Prem to solve LRU Cache.

### Complete

> Prem completed Rahul's challenge.

### Improve

> Karan improved his Binary Search time from 31m to 19m.

### Stuck

> Anonymous / named request for a nudge.

### Resource

> “This video finally made DP click for me.”

### Contest

> Weekly Contest starts in 24h.

### Squad milestone

> Squad completed 100 battles.

## Composer

Avoid a blank “What's on your mind?” box as the primary experience.

Provide:
- Share a solve
- Teach something
- Challenge someone
- Ask for help
- Share resource
- Start discussion

This creates structure and reduces low-value content.

---

# 19. Feed Surfaces

## Squad

Default.

Purpose:
- accountability,
- activity,
- shared identity.

## Following

Purpose:
- learn from people you choose,
- discover strong approaches.

## Global

Purpose:
- discovery,
- community learning,
- public resources.

## Platform

Purpose:
- contest announcements,
- product changes,
- maintenance,
- events.

Do not launch with an empty global feed pretending it is a successful social network.

---

# 20. Feed Ranking Philosophy

Primary ranking signals should reflect usefulness.

Potential internal signals:
- successful copies,
- completed related problems,
- revisits,
- challenge completions,
- meaningful discussion,
- pattern relevance,
- recency.

Do not make likes the primary competence signal.

A useful post is one that **changes what another developer does next**.

---

# 21. Following / Mentor Layer

A developer can follow another developer because their explanations are useful.

Profile signals can emphasize:
- problems solved,
- approaches shared,
- primers,
- successful forks,
- challenge completions,
- patterns frequently practiced,
- improvement history.

Avoid making follower count the main reputation system.

Long-term, profiles should communicate:

> “This person is useful to learn from.”

rather than:

> “This person has the most followers.”

---

# 22. Reputation

Reputation should be earned by useful behavior.

Possible dimensions:

### Problem solving

Verified solves.

### Teaching

Approaches / primers.

### Helpfulness

Accepted / used hints and discussions.

### Practice consistency

Real sessions over time.

### Impact

Forks, completed challenges, successful revisits.

Do not compress these immediately into a single “skill score.”

A single score creates false precision and invites gaming.

---

# 23. Pattern Mastery

Problem count alone is insufficient.

The product should eventually infer pattern confidence using signals such as:
- solved count,
- recent solved count,
- failed attempts,
- revisit success,
- novel problems,
- time improvement,
- shared approaches.

Example:

### Graphs

Exposure: 12  
Solved: 8  
Recent failures: 2  
Revisits: 3  
Novel solves: 2

Status:

**Developing**

Do not claim that this mathematically proves mastery.

It is an actionable learning estimate.

---

# 24. Personal Recommendation Engine

Initially deterministic.

Possible signals:
- low recent exposure,
- high failure rate,
- long time since revisit,
- prerequisite patterns,
- recent success plateau,
- squad activity,
- goal / roadmap.

Example:

> **Next battle**
>
> Number of Islands
>
> Why:
> - Graph exposure is low.
> - You have not practiced this pattern in 12 days.
> - You recently completed a prerequisite problem.

AI is optional later.

---

# 25. Revision

This is an important progression layer.

The first revision system should be simple.

A problem can become:

**Review due**

based on:
- failed attempt,
- long gap,
- weak pattern,
- manual bookmark,
- poor self-rated confidence.

Do not build a complex SRS algorithm until simpler behavior has been validated.

---

# 26. Squads

A squad is a real group of people.

It is not “everyone who logged in.”

Schema direction:
- `squads`
- `squad_members`

Users may belong to multiple squads.

UX can still expose **one active squad at a time** initially.

This avoids future re-migration while keeping the first UI understandable.

---

# 27. Squad Identity

A squad should contain:
- name,
- avatar,
- description,
- members,
- creator/admin,
- shared goal,
- season,
- streak,
- progress,
- activity,
- challenge history.

The objective is to make the squad feel like a **small community**, not a foreign-key relation.

---

# 28. Squad Goals

Example:

> **Complete 50 Graph problems by October 30.**

Track:
- total target,
- completed,
- members participating,
- days remaining.

Goals should generate meaningful reminders and recaps.

---

# 29. Squad Rituals

This is a key retention mechanism.

Possible rituals:

### Monday
Pattern of the Week

### Tuesday
Practice battle

### Wednesday
Challenge day

### Thursday
Teach something

### Saturday
Contest

### Sunday
Squad recap

Not every ritual needs to be mandatory.

The product should give squads a structure they can adopt.

---

# 30. Squad Seasons

Temporary campaigns prevent a permanent leaderboard from becoming stale.

Example:

## Season 01 — The Graph War

October 1 → October 21

Objective:
50 Graph problems.

Metrics:
- problems solved,
- challenges completed,
- approaches shared,
- active members.

At the end:

**Season Complete**

Then begin a new season.

Do not over-gamify this.

The season is a container for shared intent.

---

# 31. Squad Recaps

Weekly recap:

> **YOUR SQUAD THIS WEEK**
>
> 28 problems solved  
> 6 challenges  
> 4 approaches shared  
> 3 patterns practiced
>
> Biggest improvement:
> Prem — 31m → 22m
>
> Most challenged:
> 3Sum
>
> Most copied primer:
> Sliding Window

Recaps create:
- return reason,
- social recognition,
- shareable artifacts,
- evidence of progress.

---

# 32. Squad Wall

Maintain a visual history of meaningful squad milestones.

Example:

```text
Oct 01
First member joined

Oct 03
First challenge completed

Oct 07
50 problems solved

Oct 14
First Graph Battle

Oct 20
100 problems solved

Oct 30
Season complete
```

This gives squads memory.

The product should make history feel cumulative without storing an unbounded event log forever.

---

# 33. Leaderboards

## Squad leaderboard

Primary.

Purpose:
- accountability,
- comparison with people you know,
- friendly competition.

Metrics may include:
- solved,
- rating,
- contest performance,
- streak,
- challenge participation,
- recent activity.

Do not make one giant score the only metric.

## Global leaderboard

Secondary.

Purpose:
- aspiration,
- discovery,
- identity.

Keep it separate from squad rankings.

Do not let it dominate onboarding.

---

# 34. Global Leaderboard Anti-Problem

A beginner should not feel:

> “Why compete with someone who has solved 2,000 problems?”

Global rankings should therefore support:
- pagination,
- relevant segments,
- recent improvement,
- pattern categories.

Eventually consider views such as:
- most improved,
- rising,
- pattern-specific,
- recent activity.

These communicate progress better than one immortal ranking.

---

# 35. Social Graph

Use three relationship types:

## Squad membership

Mutual small-group relationship.

Purpose: accountability.

## Following

One-way relationship.

Purpose: learning / discovery.

## Challenge

Temporary actionable relationship.

Purpose: practice.

Do not create unnecessary social primitives.

No DMs in v1.

No global chat.

---

# 36. Contests

Contest reminders are valuable as recurring rituals.

The first implementation can:
- ingest contest timing,
- produce feed events,
- show upcoming contests,
- optionally send notifications.

The purpose is not to become a contest platform.

It is to create a weekly reason for squads to return.

---

# 37. Notifications

Notifications should be action-oriented.

Good:

> Rahul challenged you.

> Your squad is 3 solves away from its weekly goal.

> You have a revenge battle available.

> Your challenge was completed.

Bad:

> Someone liked your post.

> You have 14 generic notifications.

The default should be low-noise.

---

# 38. Shareable Artifacts

Mahayuddh should generate things worth sharing outside the app.

Examples:

## Battle Card

One meaningful solve.

## Squad Recap

Weekly activity.

## Season Result

Campaign completion.

## Personal Journey

30-day progress.

## Pattern Primer

A useful learning artifact.

Every share card should lead back to:
- the relevant problem,
- public note,
- squad,
- or Mahayuddh landing page.

Sharing is a growth loop, not merely a social feature.

---

# 39. LinkedIn Distribution Strategy

LinkedIn is the **credibility / distribution layer**, not the social home of the squad.

A successful launch artifact should demonstrate the product rather than announce it abstractly.

Weak:

> “I built another DSA app.”

Strong:

> “I was tired of grinding LeetCode alone, so I built a place where my friends and I can challenge, teach, and track each other.”

Then show:
- Battle Card,
- squad recap,
- challenge chain,
- approach comparison.

The product should generate the visuals needed for these posts.

---

# 40. Existing Social Graph: WhatsApp / Clubs / Discord

Squads already exist socially:
- WhatsApp groups,
- college friends,
- Discord groups,
- clubs.

Mahayuddh should not try to replace these immediately.

It should plug into them.

Examples:

> Rahul challenged you on Mahayuddh:  
> [Accept Challenge]

> Your squad completed 100 problems:  
> [View recap]

The message is the acquisition surface.

Mahayuddh becomes the practice layer underneath an existing social graph.

---

# 41. Cold Start Strategy

Never require a user to build a social graph before they see value.

New user flow:

```text
Landing
  ↓
Understand product
  ↓
Start solo / join squad
  ↓
Today's Battle
  ↓
First session
  ↓
First solve
  ↓
Challenge
  ↓
Invite / connect squad
```

Potential demo:

**Explore a Demo Squad**

A public, realistic squad should show:
- leaderboard,
- activity,
- challenges,
- shared primers,
- season goal.

The user should understand the product before committing to it.

---

# 42. Challenge Deep Link

A challenge URL should open directly to the challenge context.

Ideal:

```text
Rahul challenged you
       ↓
Problem
       ↓
Target time
       ↓
Optional message
       ↓
Accept
       ↓
Start solving
```

Signup friction should be minimized.

Do not make users complete a large onboarding wizard before they can see why someone invited them.

---

# 43. Account / LeetCode Dependency

Long-term goal:

> Mahayuddh should own the social graph and learning graph, while LeetCode remains an external source.

Do not build the long-term business around fragile scraping.

Where technically and legally appropriate, prefer lower-risk sources of verification and minimize sensitive credential handling.

Avoid making session-cookie storage a core product dependency.

If the upstream platform changes, users should lose one integration — not the identity, squads, notes, challenges, and learning history stored in Mahayuddh.

---

# 44. Trust Model

“Verified solve” should not mean “we magically know the user learned.”

It means a useful piece of external evidence supports the event.

Separate:

**Attempted**  
**Solved**  
**Explained**  
**Revisited**  
**Challenge completed**

A user may legitimately use AI.

Mahayuddh should therefore increasingly test understanding through:
- approach explanation,
- follow-up questions,
- reattempts,
- comparisons.

Do not build an adversarial anti-AI police system.

---

# 45. AI Strategy

AI should appear where it strengthens learning.

## Good uses

### Stuck assistant
Give progressively stronger hints.

### Explain my mistake
Analyze an unsuccessful attempt.

### Practice next
Suggest a problem based on pattern gaps.

### Explain-back
Ask the user to explain the solution and give feedback.

### Interview simulation
Ask follow-up questions.

## Bad uses

- instant full solutions as the primary action,
- AI-generated filler posts,
- replacing community explanations,
- auto-writing hundreds of generic primers.

The objective is not “AI-powered DSA.”

It is:

> **Use AI to increase thinking, not eliminate thinking.**

---

# 46. Community Teacher Layer

Some developers will naturally become high-value contributors.

They can publish:
- primers,
- approaches,
- mistake guides,
- resource bundles,
- pattern explanations.

The platform should surface people who are repeatedly useful.

Potential profile:

> **Ananya**
>
> 183 verified solves  
> 29 approaches  
> 7 primers  
> 124 forks  
> 31 challenge completions
>
> Often teaches:  
> Graphs · DP · Sliding Window

This is a teacher identity without needing a formal creator program.

---

# 47. Forking / Copying

Core interaction:

> **COPY TO NOTEBOOK**

Preserve origin:

> Forked from @ananya

The copied version can:
- be edited privately,
- be attached to a problem,
- become a personal primer,
- be shared later as a derivative.

This creates a knowledge propagation loop.

---

# 48. Problem History

Every problem should eventually become a timeline.

Example:

```text
Two Sum

Feb 02
Attempted

Feb 02
Solved — 14:23

Mar 04
Revisited — 11:52

Mar 07
Explained approach

Mar 07
Challenged Rahul

Mar 07
Rahul completed

Apr 01
Revisited — 08:51
```

This transforms a static green checkbox into a learning history.

---

# 49. Personal Journey

A user's profile should eventually communicate a journey.

Example:

> **30 Day DSA Journey**
>
> 43 battles  
> 31 solved  
> 8 patterns  
> 11 approaches  
> 7 challenges completed  
> 4 revenge solves  
> 3 squad battles

This is simultaneously:
- motivation,
- portfolio proof,
- shareable growth artifact.

---

# 50. Feed Anti-Ghost-Town Design

Never rely exclusively on user-generated prose.

A new squad with five users should automatically generate useful activity through:
- solves,
- challenges,
- completions,
- streaks,
- goals,
- contest events.

User posts are additive.

If a feed requires people to “be content creators,” it will die.

---

# 51. Feed Anti-Noise Design

High-quality feed objects:
- relevant,
- structured,
- problem-linked,
- pattern-linked,
- actionable.

Low-quality:
- generic “I solved #100” posts,
- spam links,
- copied solutions,
- engagement bait,
- unrelated conversation.

Early moderation can be narrow:
- reporting,
- block,
- delete own content,
- rate limits,
- public posting constraints.

Do not build a giant moderation platform before public posting is validated.

---

# 52. Product Areas

The navigation should map to user intent.

## Home

What should I do now?

## Practice

What should I solve / revise?

## Squad

Who am I doing this with?

## Feed

What are people learning?

## Notebook

What do I know?

## Challenges

Who challenged me?

## Leaderboard

How am I doing relative to others?

## Profile

What have I become good at?

Avoid navigation that merely mirrors database tables.

---

# 53. Homepage Mental Model

The homepage should answer five questions instantly:

1. What should I solve?
2. What are my friends doing?
3. What do I need to respond to?
4. What am I improving?
5. What is next?

Recommended composition:

```text
TODAY'S BATTLE
[Primary CTA]

YOUR SQUAD
Goal / streak / member activity

CHALLENGES
Pending actions

YOUR PROGRESS
Pattern weakness / recent improvement

FEED
Recent high-signal activity
```

---

# 54. Onboarding

Do not over-collect information.

Minimum viable onboarding:
- account,
- display name,
- LeetCode handle or supported identity,
- objective,
- join/create squad or continue solo.

Then immediately:

**Start your first battle.**

Do not ask users to configure their entire profile first.

---

# 55. Empty States

Empty states must teach.

Bad:

> No challenges.

Good:

> No challenges yet.  
> Solve a battle and challenge a friend.  
> **Start a battle**

Bad:

> No squad.

Good:

> Your squad is waiting.  
> Create one and invite 2–7 friends.

Bad:

> No feed activity.

Good:

> Your squad has not battled yet.  
> Start today's battle.

---

# 56. Growth Loops

## Loop A — Challenge loop

```text
User solves
→ challenges friend
→ friend receives link
→ friend joins
→ friend solves
→ friend challenges another
```

This is the strongest organic loop.

## Loop B — Share loop

```text
Solve / season / recap
→ share artifact
→ viewer discovers Mahayuddh
→ viewer creates / joins squad
```

## Loop C — Knowledge loop

```text
Good primer
→ copied
→ used
→ more people discover creator
→ creator publishes more
```

## Loop D — Squad loop

```text
Existing friends
→ squad
→ recurring ritual
→ retention
→ invites new squad
```

Do not rely on paid growth initially.

---

# 57. Metrics

The dashboard should measure the product loops, not vanity.

## Acquisition

- visits,
- signup conversion,
- challenge-link opens,
- invite acceptance.

## Activation

- first problem opened,
- first battle started,
- first verified solve,
- first challenge sent,
- first challenge received.

## Social activation

- challenge response rate,
- challenges per active squad,
- members interacting with squad.

## Learning activation

- approaches written,
- primers copied,
- notes created,
- notes reused,
- revisits.

## Retention

- D1 / D7 / D30 return,
- weekly active learners,
- active squad rate,
- squad survival.

## Growth

- invites per active user,
- challenge-driven signups,
- share-driven signups,
- squad creation from referrals.

The most important early metric is not “MAU.”

It is:

> **Does a real squad repeatedly practice through Mahayuddh?**

---

# 58. Validation Gates

Before public launch, test with real squads.

Suggested observational gates:

### Activation

Users can reach first battle quickly.

### Social activation

Users send challenges without being manually instructed.

### Learning behavior

Users actually read / copy / write approaches.

### Retention

Squads continue practicing beyond the first week.

### Organic behavior

Someone invites another person without founder prompting.

### Qualitative

Someone says some version of:

> “This is where we do DSA.”

Do not treat the numerical thresholds as universal benchmarks. They are internal experiment criteria.

---

# 59. Two-Week Real-User Test

Use a small group of real squads.

Do not start by marketing to the entire internet.

Observe:

## Day 1

Can everyone understand what to do?

## Day 3

Has someone naturally challenged someone?

## Day 7

Do people return voluntarily?

## Day 14

Does the squad have a meaningful history?

Record:
- where users hesitate,
- which features they ignore,
- what they repeatedly ask for,
- what they use outside the app instead.

User behavior outranks founder imagination.

---

# 60. Feature Decision Framework

Every proposed feature gets one of these labels:

## CORE

Directly strengthens the main loop.

## SUPPORT

Useful infrastructure or quality layer.

## EXPERIMENT

Worth testing, not yet committed.

## FUTURE

Potentially valuable after core validation.

## KILL

Adds complexity without strengthening user value.

## DUPLICATE

Already solved by an existing product / feature.

For every new feature, record:

```text
Problem:
User:
Behavior:
Core-loop link:
Alternative:
Cost:
Risk:
Success metric:
Decision:
```

---

# 61. Current Feature Classification

## Core

- Curated problem sheets
- problem tracking
- Now-Solving dock
- timer
- scratchpad
- verified solve
- squad
- squad leaderboard
- challenge
- approach sharing
- squad activity feed

## Support

- authentication
- notifications
- contest reminders
- profiles
- search
- PWA
- RLS
- analytics

## Experiment

- Battle Cards
- Beat My Time
- Challenge Chains
- Revenge
- I'm Stuck ladder
- Approach comparison
- Squad rituals
- Squad seasons
- squad goals
- weekly recaps
- public primers
- following
- teacher profiles
- fork/copy

## Future

- adaptive recommendations
- AI stuck assistant
- interview mode
- explain-back
- teacher reputation
- multi-platform identity
- voice explanations
- advanced pattern mastery

## Kill / avoid unless evidence changes

- global realtime chat
- generic DMs
- live co-editing
- own coding judge
- giant video library
- massive company-tag database
- complex XP economy
- vanity-heavy profile systems
- black-box feed ranking before enough content exists

---

# 62. Engineering Priorities

Before large feature expansion, fix known engineering hazards from the current audit:

- duplicate leaderboard fetch,
- service worker caching scope,
- LeetCode sync cooldown stamping,
- silent-empty data helpers,
- undocumented external endpoint dependence,
- accessibility zoom restriction,
- missing tests,
- missing error boundaries,
- missing CI gate,
- missing analytics,
- SEO / social metadata,
- first-run onboarding,
- LeetCode dependency / credential risk.

The product must be trustworthy before it becomes social.

---

# 63. Data Philosophy

Keep the database normalized around durable concepts.

Core entities:

```text
users / profiles
squads
squad_members
problems
problem status
suggestions / challenges
notes
note shares
feed events
feed posts
contests
comments
```

Do not store the entire feed as JSON blobs.

Do not create separate data models for every UI card.

A Battle Card should generally be a **projection of underlying entities**, not a second source of truth.

---

# 64. Feed Storage Philosophy

Use normalized event rows.

Potential event structure:

```text
actor
 event type
object type
object id
squad
metadata
created_at
```

Metadata can hold small event-specific data.

Do not endlessly retain high-frequency event noise in the hot database.

Keep permanent / important objects separate from short-lived activity.

---

# 65. Notes Storage Philosophy

Markdown is sufficient for the initial note model.

Support:
- links,
- fenced code,
- basic headings,
- lists.

Keep list views lightweight.

Do not fetch huge note bodies when rendering a list.

Add full-text search only when actual usage justifies it.

---

# 66. Multi-Squad Philosophy

Schema:

**many squads per user**

UX initially:

**one active squad**

This preserves future flexibility while controlling UI complexity.

Do not force a schema that assumes one squad per person.

Do not build a fully merged multi-squad feed until actual users need it.

---

# 67. What Mahayuddh Is NOT

Mahayuddh is not:

- a replacement for LeetCode,
- a replacement for NeetCode,
- a full course platform,
- a coding judge,
- Notion for programmers,
- Discord for DSA,
- LinkedIn for developers,
- a generic productivity tracker,
- an AI solution vending machine.

Mahayuddh is:

> **The social practice layer around technical interview preparation.**

---

# 68. Competitive Positioning

Competitors can already cover pieces of:
- friend leaderboards,
- tracking,
- challenges,
- groups,
- roadmaps,
- streaks,
- analytics.

Therefore never market:

> “We have squads and leaderboards.”

Instead market the deeper behavior:

> **Practice together. Learn from how your friends think. Challenge them. Build a shared history of getting better.**

The defensible part is not a single checkbox.

It is the integration of:
- real practice,
- social context,
- explanations,
- challenges,
- knowledge,
- progress history.

---

# 69. Potential Product Moats

## 1. Learning graph

Problem ↔ pattern ↔ person ↔ approach ↔ challenge ↔ revision.

## 2. Social graph

Squads + following + challenges.

## 3. Behavioral history

Actual sessions, solves, revisits, explanations, challenge chains.

## 4. Knowledge graph

Community primers and approaches connected to problems.

## 5. Rituals

Squads establish repeatable habits.

## 6. Shareable proof

Users naturally distribute progress artifacts.

These become stronger with scale.

---

# 70. Long-Term Product Evolution

If the core DSA loop works, the same model can expand.

Potential future domains:
- system design,
- SQL,
- DBMS,
- operating systems,
- computer networks,
- frontend interviews,
- backend interviews,
- cloud / DevOps.

But this expansion is conditional.

Do not build a “developer learning super-app” before proving the DSA case.

---

# 71. Product Roadmap

## Phase 0 — Trust

Fix:
- auth / RLS issues,
- sync reliability,
- service worker,
- tests,
- error states,
- analytics,
- public landing,
- onboarding.

## Phase 1 — Core Battle Loop

Ship:

```text
Squad
→ Today's Battle
→ Now-Solving
→ Verified Solve
→ Approach
→ Challenge
→ Squad activity
```

## Phase 2 — Learning Loop

Ship:

```text
Primers
→ Notebook
→ Copy / Fork
→ Revision
→ Pattern progress
```

## Phase 3 — Social Learning

Ship:

```text
Battle Cards
→ Beat My Time
→ Revenge
→ I'm Stuck
→ Approach comparison
→ Challenge Chains
→ Squad goals
→ Recaps
```

## Phase 4 — Community

Ship:

```text
Public notes
→ Following
→ Teacher profiles
→ Global feed
→ Discovery
```

## Phase 5 — Adaptive Intelligence

Potentially:

```text
Personal recommendations
→ AI hints
→ Explain-back
→ Interview mode
```

---

# 72. What “Great” Looks Like

A great Mahayuddh session should feel like:

> I open Mahayuddh.
>
> I immediately know what I should practice.
>
> I understand why I'm doing it.
>
> I start a focused battle.
>
> I solve or fail honestly.
>
> My result is recorded.
>
> I capture what I learned.
>
> I challenge my friend.
>
> I see how someone else approached the same problem.
>
> I learn something I didn't know.
>
> I leave knowing what I should do next.

That is the target experience.

Not:

> “Look at my dashboard.”

---

# 73. Product Quality Bar

Before declaring a feature “done,” verify:

### Utility

Does the user get a clear benefit?

### Integration

Does it connect to an existing loop?

### Speed

Can the user understand and act quickly?

### Trust

Can the system represent the state honestly?

### Social value

Does it create meaningful interaction rather than empty engagement?

### Mobile

Can it work comfortably on a phone?

### Failure state

What happens when the upstream data source is unavailable?

### Privacy

Who can see the data?

### Growth

Can the feature naturally create a share / invite / return action?

---

# 74. Agent Instructions — Product Mode

The coding/product agent MUST follow these rules.

## Rule 1

Do not interpret every founder idea as a committed feature.

## Rule 2

Before implementation, restate:
- problem,
- user,
- behavior,
- acceptance criteria.

## Rule 3

Identify what existing component should be reused.

## Rule 4

Prefer a behavioral change over a new subsystem.

## Rule 5

Do not introduce a database table merely because a UI concept exists.

## Rule 6

Do not introduce realtime architecture unless asynchronous behavior demonstrably fails.

## Rule 7

Do not build AI where deterministic logic is sufficient.

## Rule 8

Do not add gamification without a measurable behavior it improves.

## Rule 9

Every new public feature needs:
- privacy model,
- abuse considerations,
- empty state,
- error state,
- analytics event.

## Rule 10

Every major feature must state how success will be measured.

---

# 75. Founder Brainstorm Protocol

When the founder says:

> “Maybe we should build X.”

The agent should reason through:

```text
1. What problem does X solve?
2. Who has this problem?
3. How often?
4. What do they use today?
5. Does it strengthen the battle loop?
6. Does it strengthen the squad loop?
7. Does it strengthen the learning loop?
8. Does it strengthen growth?
9. What is the cheapest experiment?
10. What evidence would justify building it?
```

Only after that should the feature enter the roadmap.

---

# 76. Product Review Protocol

Every major iteration should answer:

## Are users practicing more?

## Are squads interacting?

## Are users learning from each other?

## Are they returning?

## Are new people joining through existing users?

## Are users generating useful knowledge?

If the answer is no, stop adding surface area.

---

# 77. The One-Sentence Filter

Before implementing anything, ask:

> **Does this make it more likely that a developer will practice, learn, challenge, teach, improve, or return?**

If not:

**Do not build it yet.**

---

# 78. Final Product Definition

Mahayuddh is a **social practice network for technical interview preparation**.

It connects:

```text
WHAT TO SOLVE
      ↓
HOW TO THINK
      ↓
ACTUAL PRACTICE
      ↓
PROOF
      ↓
EXPLANATION
      ↓
CHALLENGE
      ↓
PEER LEARNING
      ↓
PROGRESS
      ↓
COMMUNITY
      ↓
NEXT BATTLE
```

The platform's deepest object is not the post.

It is not the leaderboard.

It is not the note.

It is not the problem.

It is the **learning journey around a problem shared between people**.

---

# 79. Final Strategic Lock

The current product already has enough raw capability to be useful.

The next stage is not “add more.”

The next stage is:

> **Connect everything.**

A problem should lead naturally to:
- a primer,
- a battle,
- a timer,
- a proof,
- an approach,
- a challenge,
- a comparison,
- a revision,
- and another battle.

A squad should lead naturally to:
- goals,
- rituals,
- challenges,
- activity,
- recaps,
- and another week together.

A community resource should lead naturally to:
- a copy,
- a practice session,
- a solve,
- and an improvement.

A share card should lead naturally to:
- a visitor,
- a problem,
- a battle,
- and eventually a squad.

That is the Mahayuddh operating system.

**Build the system, not the feature list.**
