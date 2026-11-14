-- Wall milestones said "The squad passed 100 logged solves" when one person
-- passed 100, counting their whole history: solves from before they joined
-- the squad and LeetCode imports included. Joining a squad with an imported
-- history could post both milestones on day one.
--
-- The count is now the squad's: solves and revisits by its current members,
-- logged after each joined, excluding undated imports (metadata.imported).
-- Milestones are once per squad (unique on squad_id, kind), as before.

create or replace function public.record_solve_count_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sq record;
  total int;
begin
  if new.kind not in ('solved', 'revisited')
     or coalesce(new.metadata->>'imported', 'false') = 'true' then
    return new;
  end if;

  -- Every squad the solver is in gets its own count.
  for sq in
    select sm.squad_id from public.squad_members sm where sm.user_id = new.user_id
  loop
    select count(*) into total
    from public.problem_events e
    join public.squad_members m
      on m.user_id = e.user_id and m.squad_id = sq.squad_id
    where e.kind in ('solved', 'revisited')
      and e.created_at >= coalesce(m.joined_at, '-infinity'::timestamptz)
      and coalesce(e.metadata->>'imported', 'false') <> 'true';

    if total >= 50 then
      insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
      values (sq.squad_id, 'milestone_solves', '50 squad solves',
              'The squad logged its 50th solve together.', coalesce(new.created_at, now()))
      on conflict (squad_id, kind) do nothing;
    end if;

    if total >= 100 then
      insert into public.squad_milestones (squad_id, kind, title, detail, occurred_at)
      values (sq.squad_id, 'milestone_solves_100', '100 squad solves',
              'The squad passed 100 logged solves together.', coalesce(new.created_at, now()))
      on conflict (squad_id, kind) do nothing;
    end if;
  end loop;

  return new;
end $$;
