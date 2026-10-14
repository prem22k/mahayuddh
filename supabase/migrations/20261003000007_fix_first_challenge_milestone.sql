-- Fix for 20261003000006: record_first_challenge_milestone referenced
-- new.squad_id, but suggestions has no such column — parties are from_user and
-- to_user only.
--
-- Impact: the trigger raised on every challenge insert, so sending a challenge
-- failed outright.
--
-- The squad is derived instead: a challenge belongs to a squad when BOTH
-- parties are members of it. That is the honest definition of a squad-internal
-- challenge and avoids adding a denormalised column that could drift.

create or replace function public.record_first_challenge_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  squad uuid;
begin
  select sm.squad_id into squad
  from public.squad_members sm
  where sm.user_id = new.from_user
    and exists (
      select 1 from public.squad_members other
      where other.squad_id = sm.squad_id and other.user_id = new.to_user
    )
  order by sm.joined_at asc
  limit 1;

  -- No shared squad: this was a challenge outside any squad, so no wall entry.
  if squad is null then
    return new;
  end if;

  insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
  values (squad, 'first_challenge', 'First challenge sent',
          'Somebody decided a problem was worth handing to a squad mate.',
          new.created_at)
  on conflict (squad_id, kind) do nothing;
  return new;
end $$;