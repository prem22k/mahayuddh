-- Fix: infinite recursion between the notebook_notes and note_shares RLS policies.
--
-- /notebook and /vault were completely broken for every signed-in user. Every
-- read returned:
--
--     500  {"code":"42P01","message":"infinite recursion detected in policy
--           for relation \"notebook_notes\""}
--
-- The cycle is mutual and it is in the policies, not the code:
--
--   notebook_notes "Shared notes readable"          -> reads note_shares
--   notebook_notes "Owners and editors can update"  -> reads note_shares
--   note_shares     "Owners manage shares"          -> reads notebook_notes
--
-- Evaluating a notebook_notes policy enters note_shares, whose policy re-enters
-- notebook_notes, and Postgres refuses the whole query rather than looping. So
-- one note-sharing feature took down both the notebook and the vault, which are
-- the same feature from the user's point of view.
--
-- Why this survived to now: the static audit checks that client INSERTs supply
-- the columns their policy checks, and the existing suites cover the composer,
-- not the notebook read path. Nothing ever did a plain authenticated SELECT on
-- these two tables. The failure mode was total, and it was invisible.
--
-- Fix: move the cross-table lookups into SECURITY DEFINER functions. Inside a
-- security-definer function the tables' own RLS is not applied, so the chain
-- stops there instead of circling back.
--
-- Semantics are preserved exactly. note_shared_with with p_need_edit = false
-- means "any share, edit rights or not", which is what the SELECT policy did; with
-- true it adds `can_edit`, which is what the UPDATE policy required.
--
-- `owns_note` deliberately takes the user as a parameter rather than reading
-- auth.uid() itself, so a caller cannot use it to answer a question about
-- somebody else's privileges. Both are revoked from PUBLIC and granted only to
-- authenticated: an executable helper that answers "do I own this note" is a
-- small oracle, and it is not needed by anyone else.

create or replace function public.owns_note(p_note_id uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.notebook_notes n
    where n.id = p_note_id and n.owner_id = p_user
  );
$$;

create or replace function public.note_shared_with(
  p_note_id uuid, p_user uuid, p_need_edit boolean default false
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.note_shares s
    where s.note_id = p_note_id
      and s.shared_with = p_user
      and (not p_need_edit or s.can_edit)
  );
$$;

revoke all on function public.owns_note(uuid, uuid) from public;
revoke all on function public.note_shared_with(uuid, uuid, boolean) from public;
grant execute on function public.owns_note(uuid, uuid) to authenticated;
grant execute on function public.note_shared_with(uuid, uuid, boolean) to authenticated;

-- Re-point both sides at the helpers.
drop policy if exists "Shared notes readable" on public.notebook_notes;
create policy "Shared notes readable" on public.notebook_notes for select
  using (public.note_shared_with(id, (select auth.uid()), false));

drop policy if exists "Owners and editors can update notes" on public.notebook_notes;
create policy "Owners and editors can update notes" on public.notebook_notes for update
  using (((select auth.uid()) = owner_id)
      or public.note_shared_with(id, (select auth.uid()), true))
  with check (((select auth.uid()) = owner_id)
      or public.note_shared_with(id, (select auth.uid()), true));

drop policy if exists "Owners manage shares" on public.note_shares;
create policy "Owners manage shares" on public.note_shares
  using (public.owns_note(note_id, (select auth.uid())))
  with check (public.owns_note(note_id, (select auth.uid())));

comment on function public.owns_note(uuid, uuid) is
  'Security definer so note_shares policy checks do not re-enter notebook_notes RLS, which was an infinite loop.';
comment on function public.note_shared_with(uuid, uuid, boolean) is
  'Security definer for the same reason. p_need_edit = false means any share; true requires can_edit.';
