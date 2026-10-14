-- Security hardening: least-privilege EXECUTE, fixed search_paths, missing FK index.
--
-- 1. EXECUTE lockdown. Dozens of SECURITY DEFINER trigger helpers are
--    currently callable by anon/authenticated via /rest/v1/rpc (e.g.
--    append_problem_event_on_battle_end, rls_auto_enable, milestone
--    recorders). Triggers fire regardless of EXECUTE grants, so revoking
--    changes nothing functionally — it only closes the direct-RPC door.
--    Re-granted below: exactly the functions the app calls via supabase.rpc
--    (verified against app/ + lib/ call sites; scripts/ use none).
--    Deliberately NOT re-granted (service-role callers only):
--    attribute_join, count_referral_open, notify_contest_reminders,
--    mark_solved_from_leetcode, stuck_reminder_allowed,
--    suggestion_remind_allowed, my_referral_links(uuid),
--    owns_note(uuid,uuid), note_shared_with(uuid,uuid,bool).
--    FUTURE FUNCTIONS: add them here explicitly. The default-privileges
--    revoke at the end stops silent auto-exposure.
-- 2. search_path pinned on the 12 functions missing it (hijack surface).
-- 3. Covering index for feed_reports.discussion_id (only unindexed FK).
-- 4. Documents the intentional SECURITY DEFINER views (teacher_stats,
--    content_impact): INVOKER would silently undercount cross-user
--    aggregates through own-row RLS while exposing only counts plus
--    already-public usernames — worse than the lint. anon SELECT stays
--    because logged-out public portfolios read teacher_stats.

-- 1a. Revoke everything first (service_role/postgres untouched).
do $$
declare
  r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    -- PUBLIC first: several helpers were granted to PUBLIC, which anon
    -- inherits regardless of anon/authenticated revokes (verified live:
    -- has_function_privilege stayed true until the PUBLIC revoke landed).
    execute format('revoke all on function %s from public', r.oid::regprocedure);
    execute format('revoke all on function %s from anon, authenticated', r.oid::regprocedure);
  end loop;
end
$$;

-- 1b. Re-grant only what the app RPCs (anon needs the logged-out paths:
-- feed, leaderboard, invite preview helpers, public portfolios).
grant execute on function public.ai_calls_remaining(uuid) to anon, authenticated;
grant execute on function public.create_discussion(text, text[], text, text, uuid) to anon, authenticated;
grant execute on function public.create_discussion_reply(uuid, text) to anon, authenticated;
grant execute on function public.default_leaderboard_segment(uuid) to anon, authenticated;
grant execute on function public.get_ranked_feed(text, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.global_leaderboard(text, text, integer, integer) to anon, authenticated;
grant execute on function public.my_content_impact() to anon, authenticated;
grant execute on function public.my_referral_links() to anon, authenticated;
grant execute on function public.suggestion_chain(uuid) to anon, authenticated;
grant execute on function public.teachers_for_pattern(text, integer) to anon, authenticated;
grant execute on function public.validation_gate_board(uuid) to anon, authenticated;
grant execute on function public.validation_squads() to anon, authenticated;
grant execute on function public.validation_test_status(uuid) to anon, authenticated;

-- 1c. Stop future functions from auto-exposing to anon/authenticated.
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- 2. Pin search_path (no DEFINER changes: minimal, privilege-neutral).
alter function public.default_leaderboard_segment(uuid) set search_path = public;
alter function public.discussion_is_actionable(text) set search_path = public;
alter function public.discussion_rate_limit() set search_path = public;
alter function public.global_post_min_solves() set search_path = public;
alter function public.in_quiet_hours(timestamptz) set search_path = public;
alter function public.reply_rate_limit() set search_path = public;
alter function public.enforce_ai_ladder_ceiling() set search_path = public;
alter function public.generate_squad_code() set search_path = public;
alter function public.lock_suggestion_parties() set search_path = public;
alter function public.normalize_leetcode_username() set search_path = public;
alter function public.preserve_attempted_on_manual_import() set search_path = public;
alter function public.sync_suggestion_message() set search_path = public;

-- 3. Missing FK covering index.
create index if not exists feed_reports_discussion_id_idx
  on public.feed_reports (discussion_id);

-- 4. Intentional DEFINER views, on the record.
comment on view public.teacher_stats is
  'Intentional SECURITY DEFINER: aggregates cross-user rows (battles own-row RLS, owner-scoped notes) that INVOKER would silently undercount; exposes counts plus public usernames only. anon SELECT required by logged-out public portfolios.';
comment on view public.content_impact is
  'Intentional SECURITY DEFINER: fork-chain attribution over RLS-scoped notes; exposes fork relationships and public usernames only.';
