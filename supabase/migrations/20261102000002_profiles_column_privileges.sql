-- Make the 20260916000001 trust boundary actually hold.
--
-- That migration meant two things: clients may update only username and
-- avatar_url, and the encrypted LeetCode session is server-only. Both halves
-- were no-ops wherever anon/authenticated hold table-level privileges, which is
-- every Supabase project (default privileges grant ALL on new tables):
--
--   - a column-level REVOKE does not narrow a table-level GRANT, so
--     `revoke select (leetcode_session_encrypted)` left the column readable;
--     with the profiles read policy USING (true), anyone with the public anon
--     key could GET /rest/v1/profiles?select=leetcode_session_encrypted
--   - a fresh install (schema.sql) re-received table-level UPDATE, so a signed
--     in user could write their own streak and stats
--
-- Fix: drop the table-level SELECT and UPDATE, then grant SELECT on every
-- column except the session, and UPDATE on the two display columns. Client
-- code already reads profiles through explicit column lists
-- (PUBLIC_PROFILE_COLUMNS) and writes through server routes, so nothing it
-- does changes. A NEW profiles column is not client-readable until granted:
-- add it to a grant like the one below in the migration that creates it.
-- service_role and postgres keep full access.

revoke select, update on public.profiles from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name <> 'leetcode_session_encrypted';
  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);
end
$$;

grant update (username, avatar_url) on public.profiles to authenticated;
