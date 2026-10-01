-- daily_battles write policy (follow-up to 20261003000000).
--
-- The gap-repair migration intentionally left daily_battles read-only for
-- clients so nobody could re-roll another's battle. Own-row writes are safe:
--   - the row is keyed (user_id, battle_date), so a client can only touch TODAY'S
--     pick for THEMSELVES and no one else's
--   - the pick is computed by the deterministic engine in lib/dailyBattle.ts, so
--     a tampered slug would only mislabel the caller's own dashboard
-- With RLS scoped to auth.uid() = user_id there is no cross-user write path.
drop policy if exists "Users insert own daily battles" on public.daily_battles;
create policy "Users insert own daily battles" on public.daily_battles
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own daily battles" on public.daily_battles;
create policy "Users update own daily battles" on public.daily_battles
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own daily battles" on public.daily_battles;
create policy "Users delete own daily battles" on public.daily_battles
  for delete using ((select auth.uid()) = user_id);