-- A solved battle completes the challenge it was started from.
--
-- Accepting a challenge starts a battle that carries battles.challenge_id. When
-- that battle ended solved, the challenge stayed pending until the recipient
-- found "Mark solved" in a row menu on /challenges, so most challenges never
-- completed, the sender was never told, and the chain never moved on.
--
-- The solve is the proof the manual path asks for (markSuggestionCompleted
-- requires the caller's own solved status), and it is guarded the same way:
-- only the challenged member's own battle, only a pending challenge. The status
-- change fires notify_challenge_completed, so the sender gets the notice. The
-- feed row mirrors what the manual path logs.
create or replace function public.complete_challenge_from_battle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.suggestions%rowtype;
begin
  update public.suggestions
     set status = 'completed',
         completed_at = now()
   where id = new.challenge_id
     and to_user = new.user_id
     and status = 'pending'
  returning * into s;

  if found then
    insert into public.feed_events (user_id, event_type, squad_id, problem_title, problem_slug, difficulty, object_id)
    values (
      new.user_id,
      'complete',
      (select active_squad_id from public.profiles where id = new.user_id),
      s.problem_title,
      lower(s.problem_slug),
      s.difficulty,
      s.id
    );
  end if;

  return new;
end $$;

revoke all on function public.complete_challenge_from_battle() from public;
revoke all on function public.complete_challenge_from_battle() from anon, authenticated;

drop trigger if exists complete_challenge_on_battle_solved on public.battles;
create trigger complete_challenge_on_battle_solved
  after update on public.battles
  for each row
  when (old.outcome is distinct from new.outcome
        and new.outcome = 'solved'
        and new.challenge_id is not null)
  execute function public.complete_challenge_from_battle();
