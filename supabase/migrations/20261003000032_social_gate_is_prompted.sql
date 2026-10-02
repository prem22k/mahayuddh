-- Step 27 — correct the §58 social gate's claim about what it measures.
--
-- 20261003000031 said, of the social gate:
--
--   'No surface in the product instructs sending a challenge, so these are
--    unprompted. It cannot show intent.'
--
-- That was written from the shape of the code rather than from the product, and
-- it is false. Six surfaces tell the member to challenge someone:
--
--   app/practice/[slug]/page.tsx  "Solved — now explain it, challenge someone…"
--   app/practice/[slug]/page.tsx  a "Challenge someone" button
--   app/challenges/page.tsx       "Challenge a Friend"
--   app/challenges/page.tsx       empty state: "Solve a battle and challenge…"
--   app/challenges/page.tsx       empty state, second variant
--   app/leaderboard/page.tsx      "Challenge a friend to start"
--   app/home/page.tsx             "Challenge your squad with tough questions"
--
-- So the count measures prompt-following. §58 asks whether users send challenges
-- "without being manually instructed", and §59's day-3 question is whether one
-- happened "naturally" — which is not what this number is.
--
-- The gate stays, because challenges sent is still worth counting. What changes is
-- the claim attached to it: it is a prompted-behaviour counter, and the honest
-- §58 question is answered by the §59 observation log, not by SQL. Note that
-- BEFORE this correction the detail line read as though the number settled the
-- question, which is the same class of mistake as counting reads as learning.

create or replace function public.gate_social(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select 'social', c.n_sent > 0,
    c.n_sent::text || ' challenges sent, ' || c.n_done::text || ' completed',
    case when c.n_sent = 0
      then 'Nobody has sent a challenge. Whether one happens naturally by day 3 is §59''s question, and it is an observation — this count cannot see it.'
      else 'These are PROMPTED, not unprompted: the product says "challenge someone" in at least six places, including a button after every solve. §58 asks about challenges sent without being instructed, so this number does not answer that. Read the §59 log for it.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)
          and s.status = 'completed') as n_done
  ) c
  where c.n_members > 0
$$;

comment on function public.gate_social(uuid) is
  '§58 social activation, counting challenges sent. The product prompts this in six places, so the count is prompted behaviour and does NOT answer §58''s "without being manually instructed" — that comes from the §59 observation log.';
