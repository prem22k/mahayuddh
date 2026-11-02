-- Restore EXECUTE on the two helpers the notebook RLS policies call.
--
-- 20261004000003 revoked EXECUTE on every public function and re-granted only
-- what the app calls through supabase.rpc. It skipped owns_note(uuid) and
-- note_shared_with(uuid, boolean), which no client calls directly but which
-- "Owners manage shares" (note_shares) and "Shared notes readable" / "Owners
-- and editors can update notes" (notebook_notes) evaluate on every query.
-- A permission error inside any policy expression fails the whole statement,
-- so since that migration every notebook_notes and note_shares read or write
-- by anon or authenticated has failed with 42501 (403 over REST): the notebook,
-- vault and shared notes did not load at all.
--
-- These are the caller-scoped overloads 20261003000037 introduced and granted:
-- they read auth.uid() and take no user argument, so they answer only the
-- caller's own access. The user-argument overloads (owns_note(uuid, uuid),
-- note_shared_with(uuid, uuid, boolean)) stay revoked.
--
-- Policy helpers count as "functions the app calls": any new function used in
-- a policy needs an explicit grant here, like the rpc list in 20261004000003.

grant execute on function public.owns_note(uuid) to anon, authenticated;
grant execute on function public.note_shared_with(uuid, boolean) to anon, authenticated;
