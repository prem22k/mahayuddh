-- Close the oracle that 20261003000035 accidentally opened.
--
-- Those functions revoke EXECUTE from PUBLIC and grant it to authenticated, which
-- is correct as far as it goes — and it did not work. Supabase configures
--
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role
--
-- so creating a function in public hands `anon` an EXPLICIT grant. Revoking from
-- PUBLIC does not remove an explicit grant made to a named role, so `owns_note`
-- and `note_shared_with` were callable by anonymous visitors — a working oracle
-- for "does this account own this note" and "who is this note shared with".
--
-- Caught by tests/integration/notebook.mjs, which asserts the negative rather
-- than trusting the DDL.
--
-- The lesson is the one worth keeping: revoking from PUBLIC is not the same as
-- revoking from anon. In a Supabase project PUBLIC and anon are different things,
-- and only the narrower statement is true.
--
-- service_role keeps EXECUTE deliberately: server code resolves shares through
-- these helpers, and it bypasses RLS anyway.

revoke all on function public.owns_note(uuid, uuid) from anon;
revoke all on function public.note_shared_with(uuid, uuid, boolean) from anon;
revoke all on function public.owns_note(uuid, uuid) from public;
revoke all on function public.note_shared_with(uuid, uuid, boolean) from public;
grant execute on function public.owns_note(uuid, uuid) to authenticated, service_role;
grant execute on function public.note_shared_with(uuid, uuid, boolean) to authenticated, service_role;

-- Audit trail: report any security-definer helper still reachable by anon.
do $$
declare
  v_leak text;
begin
  select string_agg(p.proname, ', ') into v_leak
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    -- The §58 gate functions are granted to anon on purpose: they report
    -- counts, never identities, and a member should be able to review their own
    -- squad without a different door from the researcher.
    and p.proname not like 'gate\_%'
    and p.proname <> 'validation\_%'
    and p.proname not in ('my_content_impact', 'feed_usefulness', 'global_leaderboard');
  if v_leak is not null then
    raise notice 'security-definer functions still callable by anon (review each): %', v_leak;
  end if;
end $$;
