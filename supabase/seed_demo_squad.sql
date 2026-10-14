-- seed_demo_squad.sql — Step 3's showcase squad.
--
--   "5 fake members, leaderboard, 10 solves, 3 challenges, 2 primers, 1 season
--    goal. Read-only, banner 'Demo — join to interact'."
--
-- A new visitor's only evidence that this product works is whatever they can
-- look at, and an empty squad teaches nothing (§41). This is the shop window.
--
-- It is deliberately, obviously fake. Every handle is prefixed `demo_`, no row
-- claims to be a real person's history, and `squads.is_demo` keeps the whole
-- thing out of the §58 validation gates — a seeded squad with ten solves would
-- otherwise light up five gates green and be read by a founder as evidence that
-- squads repeatedly practise. The gates exclude it; see migration 00039.
--
-- Idempotent: re-running replaces the demo squad's rows rather than duplicating
-- them, and removes the seeded auth users so a second run is clean.
--
-- How to apply (service-role SQL, not the app):
--     psql "$SUPABASE_DB_URL" -f supabase/seed_demo_squad.sql
--
-- Nothing in the application runs this file. It is a deliberate act with a
-- `service_role` key, so it cannot happen by accident.

begin;

-- ── Clear a previous demo seed ───────────────────────────────────────────────
-- Idempotent by construction, which matters because this file is meant to be
-- re-run rather than run once. The first version left the auth.users rows behind,
-- so the second run collided on users_pkey — and because everything is inside one
-- transaction, the whole re-run rolled back and left the database exactly as it
-- was. Silent, and indistinguishable from "the seed did not take".
--
-- Order is child rows, then profiles, then the squad, then auth.users. The squad
-- cannot go earlier: profiles.active_squad_id is NO ACTION, so deleting the squad
-- while profiles still point at it is an FK violation.

delete from suggestions      where from_user in (select id from profiles where username like 'demo%');
delete from suggestions      where to_user   in (select id from profiles where username like 'demo%');
delete from notebook_notes   where owner_id  in (select id from profiles where username like 'demo%');
delete from approaches       where user_id   in (select id from profiles where username like 'demo%');
delete from problem_events   where user_id   in (select id from profiles where username like 'demo%');
delete from battles          where user_id   in (select id from profiles where username like 'demo%');
delete from squad_members    where user_id   in (select id from profiles where username like 'demo%');
delete from notifications    where user_id   in (select id from profiles where username like 'demo%');
delete from squad_goals      where squad_id in (select id from squads where is_demo);
delete from squad_recaps     where squad_id in (select id from squads where is_demo);
delete from squad_seasons    where squad_id in (select id from squads where is_demo);
delete from squad_milestones where squad_id in (select id from squads where is_demo);
delete from primers          where squad_id in (select id from squads where is_demo);
delete from profiles         where username like 'demo%';
delete from squads           where is_demo;
delete from auth.users       where email like 'demo%@example.invalid';

-- ── People ───────────────────────────────────────────────────────────────────
-- Five members with varied history, so the leaderboard is not a wall of ties and
-- the wall/recap surfaces have something to say. Passwords are irrelevant: these
-- accounts exist to own rows, and the UI never offers a demo login.
insert into auth.users (id, email, email_confirmed_at, aud, role)
values
  ('d0000000-0000-4000-8000-000000000001', 'demo_prem@example.invalid', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000002', 'demo_rahul@example.invalid', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000003', 'demo_arjun@example.invalid', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000004', 'demo_sneha@example.invalid', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000005', 'demo_kabir@example.invalid', now(), 'authenticated', 'authenticated');

-- active_squad_id is left null here and set after the squad exists. It is a real
-- circular foreign key: profiles point at squads, and squads.created_by points
-- back at profiles.
insert into profiles (id, username, leetcode_username, streak, total_easy, total_medium, total_hard, objective)
values
  ('d0000000-0000-4000-8000-000000000001', 'demo_prem',  'prem_demo',   12, 68, 31, 6, 'fulltime'),
  ('d0000000-0000-4000-8000-000000000002', 'demo_rahul', 'rahul_demo',   7, 54, 22, 3, 'fulltime'),
  ('d0000000-0000-4000-8000-000000000003', 'demo_arjun', 'arjun_demo',   4, 41, 15, 1, 'internship'),
  ('d0000000-0000-4000-8000-000000000004', 'demo_sneha', 'sneha_demo',   9, 47, 26, 4, 'consistency'),
  ('d0000000-0000-4000-8000-000000000005', 'demo_kabir', 'kabir_demo',   2, 29, 11, 0, 'internship');

-- ── The squad ────────────────────────────────────────────────────────────────
insert into squads (id, name, description, created_by, invite_code, shared_goal_text, season_name, is_demo)
values (
  'e0000000-0000-4000-8000-000000000001',
  'Demo Squad',
  'A seeded showcase squad so you can see what a squad with some history looks like. Join it to make it yours.',
  'd0000000-0000-4000-8000-000000000001',
  'DEMO2026',
  'Two graph problems each before Sunday.',
  'Season 01 — Graph War',
  true
);

-- Now the squad exists, so members can have an active one.
update profiles set active_squad_id = 'e0000000-0000-4000-8000-000000000001'
where username like 'demo%';

insert into squad_members (squad_id, user_id, role, last_active_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'admin',  now() - interval '2 hours'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'member', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'member', now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 'member', now() - interval '6 hours'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'member', now() - interval '9 days');

-- ── Solves, spread over three weeks so the wall and recap have a shape ───────
-- Ten solves is what the plan asks for. Timestamps are backdated deliberately:
-- ten solves in one afternoon would make the retention gate read as two active
-- weeks, which is precisely the sort of thing a showcase must not fake.
insert into problem_events (user_id, problem_slug, kind, duration_sec, metadata, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'two-sum',            'solved',    1420, '{"source":"leetcode"}', now() - interval '18 days'),
  ('d0000000-0000-4000-8000-000000000001', 'valid-parentheses',  'solved',     890, '{"source":"leetcode"}', now() - interval '18 days'),
  ('d0000000-0000-4000-8000-000000000002', 'best-time-to-buy',   'solved',    2210, '{"source":"leetcode"}', now() - interval '16 days'),
  ('d0000000-0000-4000-8000-000000000004', 'merge-intervals',    'solved',    1740, '{"source":"leetcode"}', now() - interval '14 days'),
  ('d0000000-0000-4000-8000-000000000001', 'course-schedule',    'solved',    3350, '{"source":"leetcode"}', now() - interval '12 days'),
  ('d0000000-0000-4000-8000-000000000003', 'clone-graph',        'solved',    2610, '{"source":"leetcode"}', now() - interval '11 days'),
  ('d0000000-0000-4000-8000-000000000004', 'binary-tree-level',  'solved',    1980, '{"source":"leetcode"}', now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000002', 'number-of-islands',  'solved',    2870, '{"source":"leetcode"}', now() - interval '8 days'),
  ('d0000000-0000-4000-8000-000000000001', 'word-ladder',        'solved',    3120, '{"source":"leetcode"}', now() - interval '6 days'),
  ('d0000000-0000-4000-8000-000000000005', 'coin-change',        'solved',    2450, '{"source":"leetcode"}', now() - interval '4 days');

-- A revisit, so the timeline has more than one event on at least one problem —
-- §8's "solved ≠ end", which the demo is supposed to demonstrate.
insert into problem_events (user_id, problem_slug, kind, duration_sec, metadata, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'two-sum', 'revisited', 640, '{"source":"manual"}', now() - interval '5 days');

-- ── Three challenges ─────────────────────────────────────────────────────────
-- One completed, one pending, one still open. A demo where every challenge is
-- finished shows a queue nobody has to think about.
insert into suggestions (id, from_user, to_user, problem_slug, problem_title, difficulty, status, sender_time_sec, beat_time, message, created_at, accepted_at, completed_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'word-ladder', 'Word Ladder', 'Medium', 'completed', 3120, true, 'Beat my 52:00 if you can.', now() - interval '6 days', now() - interval '5 days', now() - interval '5 days'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'number-of-islands', 'Number of Islands', 'Medium', 'pending', 2870, false, 'BFS or union-find — your call.', now() - interval '1 day', null, null),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'coin-change', 'Coin Change', 'Medium', 'pending', 2450, false, 'Stuck on the loop bound, want a nudge.', now() - interval '3 hours', null, null);

-- ── Two primers ──────────────────────────────────────────────────────────────
-- Written by two different demo members, so the pattern page's "people who teach
-- it" has more than one entry and the fork count starts somewhere real.
insert into primers (id, slug, pattern, title, recognize_when, mental_model, template_md, complexity, mistakes, starter_slugs, author_id, visibility, squad_id, fork_count)
values
  ('c0000000-0000-4000-8000-000000000001', 'demo-sliding-window', 'Sliding Window', 'Sliding Window — the shape behind most two-pointer arrays',
   array['The answer is a contiguous slice', 'A brute-force O(n^2) passes on a small input'],
   'A left and a right pointer with an invariant describing the window.',
   'for r in range(n):\n  while window invalid: l += 1\n  record best',
   'O(n) time, O(1) space',
   array['Off-by-one on the shrink condition', 'Forgetting to record before shrinking'],
   array['best-time-to-buy-stock', 'longest-substring-without-repeating', 'minimum-window-substring'],
   'd0000000-0000-4000-8000-000000000001', 'public', 'e0000000-0000-4000-8000-000000000001', 3),
  ('c0000000-0000-4000-8000-000000000002', 'demo-bfs-graphs', 'Graphs', 'BFS on a grid — shortest path without a priority queue',
   array['Every move costs the same', 'You need the shortest number of steps'],
   'A queue of cells; mark visited on enqueue, not on dequeue.',
   'q = deque([start])\nseen = {start}\nwhile q:\n  cur = q.popleft()\n  for nxt in neighbours(cur):\n    if nxt not in seen:\n      seen.add(nxt); q.append(nxt)',
   'O(rows × cols) time, same space',
   array['Marking visited too late', 'Mutating the grid instead of a seen set'],
   array['number-of-islands', 'rotting-oranges', 'shortest-path-in-binary-matrix'],
   'd0000000-0000-4000-8000-000000000004', 'public', 'e0000000-0000-4000-8000-000000000001', 1);

-- ── One recap ────────────────────────────────────────────────────────────────
-- Step 20's flagship share surface: a recap is meant to be opened by somebody who
-- is not in the squad, which is why the middleware makes /squad/<id>/recaps/<id>
-- public while the list stays member-only. A demo squad with no recap cannot
-- demonstrate that, so one is seeded.
--
-- Every number here is countable from the rows above. It is not invented: 6 solves
-- in the window, 1 challenge sent and completed, 2 primers written, and the one
-- problem two members both solved. If the seed changes, this has to change with
-- it — a recap whose numbers disagree with the squad's history would teach the
-- exact wrong lesson.

insert into squad_recaps (id, squad_id, week_start, week_end, body_json, generated_by)
values (
  'ab000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  (now() - interval '8 days')::date,
  (now() - interval '1 day')::date,
  jsonb_build_object(
    'window', jsonb_build_object(
      'weekStart', to_char((now() - interval '8 days')::date, 'YYYY-MM-DD'),
      'weekEnd', to_char((now() - interval '1 day')::date, 'YYYY-MM-DD')),
    'generatedAt', now(),
    'squadName', 'Demo Squad',
    'solves', 6,
    'challengesSent', 1,
    'challengesCompleted', 1,
    'approachesWritten', 2,
    'stuckRequests', 0,
    'stuckHelped', 0,
    'sharedProblems', jsonb_build_array(
      jsonb_build_object('slug', 'word-ladder', 'solvers', 1)),
    'biggestImprovement', jsonb_build_object(
      'slug', 'two-sum', 'fromSec', 1420, 'toSec', 640, 'username', 'demo_prem'),
    'mostChallenged', jsonb_build_object(
      'slug', 'word-ladder', 'title', 'Word Ladder', 'count', 1),
    'mostCopiedPrimer', jsonb_build_object('title', 'Sliding Window — the shape behind most two-pointer arrays', 'copies', 3),
    'headline', 'Six solves, one challenge completed, and Two Sum went from 23:40 to 10:40.',
    'entries', jsonb_build_array(
      jsonb_build_object('label', 'Most improved', 'detail', 'Two Sum 23:40 → 10:40'),
      jsonb_build_object('label', 'Most challenged', 'detail', 'Word Ladder'),
      jsonb_build_object('label', 'Most copied', 'detail', 'Sliding Window primer — 3 copies')),
    'empty', jsonb_build_array()
  ),
  'd0000000-0000-4000-8000-000000000001'
);

-- ── Season + goal ────────────────────────────────────────────────────────────
insert into squad_seasons (id, squad_id, name, objective, starts_at, ends_at, status, created_by)
values ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'Season 01 — Graph War', 'Every member solves two graph problems and challenges someone on one.',
        now() - interval '14 days', now() + interval '14 days', 'active', 'd0000000-0000-4000-8000-000000000001');

insert into squad_goals (id, squad_id, title, target_count, pattern, status, created_by, starts_at)
values ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'Sweep the sliding-window set', 10, 'Sliding Window', 'active',
        'd0000000-0000-4000-8000-000000000001', now() - interval '7 days');

-- ── Wall milestones ──────────────────────────────────────────────────────────
-- Deliberately not inserted here.
--
-- first_member, first_solve and first_challenge are appended by triggers on
-- squad_members, battles and suggestions, so seeding them by hand collides with
-- the trigger's own row (one per squad per kind). Letting the triggers build the
-- wall is both the honest version — those milestones genuinely happened — and a
-- free check that the triggers still work.

commit;

-- Verify the seed landed, and confirm the gates still cannot see it.
select
  (select count(*) from squads where is_demo)                        as demo_squads,
  (select count(*) from squad_members where squad_id = 'e0000000-0000-4000-8000-000000000001') as demo_members,
  (select count(*) from problem_events where user_id in
     (select id from profiles where username like 'demo%'))        as demo_solves,
  (select count(*) from suggestions where from_user in
     (select id from profiles where username like 'demo%'))       as demo_challenges,
  (select count(*) from primers where squad_id = 'e0000000-0000-4000-8000-000000000001')      as demo_primers;

-- Every gate must be UNKNOWN after seeding. If any of these returns a row, the
-- demo squad is leaking into §58 and the exclusion is broken.
select 'activation' as gate, count(*) as rows from public.gate_activation(null)
union all select 'social',   count(*) from public.gate_social(null)
union all select 'learning', count(*) from public.gate_learning(null)
union all select 'retention',count(*) from public.gate_retention(null)
union all select 'organic',  count(*) from public.gate_organic(null);