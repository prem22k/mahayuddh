-- Step 27 — distinguish "the instrument works" from "the test has happened".
--
-- The gate board is currently readable as a verdict. It is not one. With four
-- synthetic members in the database from testing, it renders four red "fail"
-- badges that are arithmetically correct and completely meaningless — nobody has
-- been asked to do anything. §59 is what makes a result a result: an observation
-- recorded by a human who was there.
--
-- So the page needs to be able to say, from data, whether anyone has actually
-- observed anything yet. That is not a designer's judgement call, it is a count,
-- and counting it in SQL keeps it out of the component.

create or replace function public.validation_test_status(p_squad_id uuid default null)
returns table (member_count bigint, observation_count bigint, squad_count bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.squad_members m
      where p_squad_id is null or m.squad_id = p_squad_id),
    -- RLS applies to validation_observations, and this function is security
    -- definer, so an observer's own rows are visible to the caller through it.
    -- Deliberately: the count is the researcher's own tally.
    (select count(*) from public.validation_observations o
      where p_squad_id is null or o.squad_id = p_squad_id),
    (select count(distinct m.squad_id) from public.squad_members m
      where p_squad_id is null or m.squad_id = p_squad_id)
$$;

comment on function public.validation_test_status(uuid) is
  'Member and observation counts for the scope. observation_count is the honest answer to "has the two-week test started?" — gates alone never are.';

grant execute on function public.validation_test_status(uuid) to authenticated;
