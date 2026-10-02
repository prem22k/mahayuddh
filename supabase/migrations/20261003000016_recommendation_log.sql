-- Step 24 — Recommendation logging.
--
-- §24: "Logging: store recommendation + accepted/rejected to validate signal
-- weights before any AI."
--
-- That last clause is the point. The engine in lib/recommend.ts is hand-weighted
-- and its weights are a guess about what helps. This table is how the guess
-- gets checked: over time, a signal whose recommendations are always ignored is
-- a signal with a wrong weight, and that should be discovered from data rather
-- than from an argument.
--
-- The why-bullets are stored verbatim alongside the decision. Storing only the
-- decision would leave no way to tell "they ignored it because it was wrong"
-- from "the reason that mattered was the one we are about to delete".

create table if not exists public.recommendation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  problem_title text,
  difficulty text check (difficulty is null or difficulty in ('Easy', 'Medium', 'Hard')),
  pattern text,
  -- Verbatim why-bullets, so a signal can be blamed or credited later.
  why_json text[] not null default '{}',
  -- 'shown' records that the engine offered it. accepted/rejected are the
  -- decision. 'shown' exists because a recommendation nobody acted on is not
  -- the same as one never displayed.
  decision text not null default 'shown'
    check (decision in ('shown', 'accepted', 'rejected', 'dismissed')),
  -- Which surface offered it, so Home and the practice hub can be compared.
  surface text check (surface is null or surface in ('home', 'practice_hub', 'problem')),
  -- The engine version that produced it. §24 forbids a black-box score, so the
  -- weights live in code; this is what ties a row to the weights that made it.
  engine_version int not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists recommendation_log_user_idx
  on public.recommendation_log (user_id, created_at desc);
create index if not exists recommendation_log_decision_idx
  on public.recommendation_log (decision, created_at desc);

alter table public.recommendation_log enable row level security;

-- Private: this is a record of what we told somebody and what they did with it.
-- Readable only by the person it is about, so the table cannot be used to
-- compare two people's accept rates from the client.
drop policy if exists "Users see own recommendation log" on public.recommendation_log;
create policy "Users see own recommendation log" on public.recommendation_log for select
  using ((select auth.uid()) = user_id);
drop policy if exists "Users log own recommendations" on public.recommendation_log;
create policy "Users log own recommendations" on public.recommendation_log for insert
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own recommendation decisions" on public.recommendation_log;
create policy "Users update own recommendation decisions" on public.recommendation_log for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);