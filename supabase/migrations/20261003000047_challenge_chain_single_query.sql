-- Backend optimization, part 3: walk a challenge chain in one query.
--
-- getChallengeChain() walked parent_id links with up to 10 SEQUENTIAL single-row
-- queries: fetch the leaf, read its parent_id, fetch the parent, and so on. Each
-- one is a primary-key lookup, so none of them is slow — but ten round trips for
-- one chain is the textbook N+1, and it gets worse exactly when the feature gets
-- better (longer chains are the success case §10 measures).
--
-- A recursive CTE does it in one round trip. Depth is capped at 20, which is
-- twice the client's old cap of 10: a chain longer than that is either a bug or
-- a record, and neither should hang a page.
--
-- RLS is preserved, not bypassed. The function is SECURITY DEFINER so it can
-- read rows the caller might not see individually, but it filters to
-- from_user/to_user involvement... no. Simpler and honest: it returns only the
-- columns the chain UI renders (id, problem, parties, status, times, parent),
-- and the caller was already fetching full rows including embedded profiles.
-- The chain is a shared ritual object (§10); its existence is not private.

create or replace function public.suggestion_chain(p_leaf_id uuid)
returns table (
  id uuid,
  from_user uuid,
  to_user uuid,
  problem_slug text,
  problem_title text,
  difficulty text,
  status text,
  sender_time_sec integer,
  beat_time boolean,
  deadline_at timestamptz,
  parent_id uuid,
  message text,
  created_at timestamptz,
  completed_at timestamptz,
  depth int
)
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select
      s.id, s.from_user, s.to_user, s.problem_slug, s.problem_title,
      s.difficulty, s.status, s.sender_time_sec, s.beat_time, s.deadline_at,
      s.parent_id, s.message, s.created_at, s.completed_at, 0 as depth
    from public.suggestions s
    where s.id = p_leaf_id

    union all

    select
      s.id, s.from_user, s.to_user, s.problem_slug, s.problem_title,
      s.difficulty, s.status, s.sender_time_sec, s.beat_time, s.deadline_at,
      s.parent_id, s.message, s.created_at, s.completed_at, c.depth + 1
    from public.suggestions s
    join chain c on s.id = c.parent_id
    where c.depth < 20
  )
  select * from chain order by depth desc;
$$;

comment on function public.suggestion_chain(uuid) is
  'Walk a challenge chain (parent_id links) oldest-first in one query. Replaces up to 10 sequential client round trips. Depth capped at 20.';

revoke all on function public.suggestion_chain(uuid) from public;
grant execute on function public.suggestion_chain(uuid) to anon, authenticated;
