-- Follow-up to 20261004000003: several helpers were granted to PUBLIC,
-- which anon inherits regardless of anon/authenticated revokes (verified
-- live: has_function_privilege stayed true until the PUBLIC revoke landed).
-- Same keep-list, same no-behavior-change guarantee (triggers fire
-- regardless; service_role/postgres grants untouched).
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
    execute format('revoke all on function %s from public', r.oid::regprocedure);
    execute format('revoke all on function %s from anon, authenticated', r.oid::regprocedure);
  end loop;
end
$$;
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
