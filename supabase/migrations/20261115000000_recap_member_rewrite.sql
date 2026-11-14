-- Recaps: any member can rewrite this week's; nobody can rewrite a past week's.
--
-- Updates were allowed only for generated_by, and generateRecap upserts on
-- (squad_id, week_start). So once one member wrote this week's recap, every
-- other member's "Write this week's recap" hit the update path and failed with
-- "Couldn't save that recap", while the writer could keep rewriting old weeks,
-- although the page called them frozen.
--
-- Now: a squad member may update a recap while its week (IST, like the rest of
-- the app) is still running. After week_end, nobody can, which is what makes
-- "Frozen" true.

drop policy if exists "Generators update own recaps" on public.squad_recaps;
drop policy if exists "Members update this week's recap" on public.squad_recaps;
create policy "Members update this week's recap" on public.squad_recaps
  for update
  using (
    week_end >= (now() at time zone 'Asia/Kolkata')::date
    and exists (
      select 1 from public.squad_members m
      where m.squad_id = squad_recaps.squad_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    week_end >= (now() at time zone 'Asia/Kolkata')::date
    and generated_by = (select auth.uid())
    and exists (
      select 1 from public.squad_members m
      where m.squad_id = squad_recaps.squad_id
        and m.user_id = (select auth.uid())
    )
  );
