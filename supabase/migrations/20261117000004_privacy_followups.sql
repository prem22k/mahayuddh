-- Privacy follow-ups from the 2026-11-17 production audit.
--
-- Not in here, on purpose: profiles.active_squad_id (who points at which
-- squad) is still readable. Hiding it needs the app to load a user's own
-- profile through the server instead of the browser, which is a separate,
-- watched change.

-- ── 1. Challenges were readable by anyone, messages included ────────────────
-- Now: the two people in it, and anyone who shares a squad with either of
-- them (the squad page, recaps and goals show challenges among members).
-- Public profile numbers come from teacher_stats, which counts as its owner.
drop policy if exists "Allow public read access for suggestions" on public.suggestions;
create policy "Challenges readable by their people and squadmates" on public.suggestions
  for select using (
    (select auth.uid()) = from_user
    or (select auth.uid()) = to_user
    or exists (
      select 1
      from public.squad_members me
      join public.squad_members them on them.squad_id = me.squad_id
      where me.user_id = (select auth.uid())
        and them.user_id in (suggestions.from_user, suggestions.to_user)
    )
  );

-- ── 2. ai_calls_remaining told anyone how much AI a squad had used ──────────
-- Its only caller is lib/ai/gate.ts, with the service role.
revoke all on function public.ai_calls_remaining(uuid) from public, anon, authenticated;
grant execute on function public.ai_calls_remaining(uuid) to service_role;

-- ── 3. A squad's creator could rewrite any column of it ─────────────────────
-- Including is_demo (which drops a squad from the squad board), ai_enabled,
-- invite_code and created_by. Browsers never write squads directly: they are
-- created by /api/squads and made public or private by set_squad_visibility.
-- The creator keeps the plain fields.
revoke insert, update on public.squads from anon, authenticated;
grant update (name, avatar_url, description, visibility) on public.squads to authenticated;
