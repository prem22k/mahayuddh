-- Repair the regression 00036 caused, without reopening the oracle.
--
-- 00036 revoked EXECUTE on the note helpers from anon. That fixed the probe but
-- broke public notes: "Public notes readable" is part of the same SELECT policy
-- list as "Shared notes readable", the latter calls note_shared_with, and a
-- permission error inside any policy expression fails the whole query. So an
-- anonymous visitor could no longer read a note marked public.
--
-- Granting the functions back to anon would restore that and reopen the probe.
-- The better answer is to stop taking the user as an argument.
--
--     note_shared_with(p_note_id, p_user, p_need_edit)   -- "is P_USER a sharee?"
--     note_shared_with(p_note_id, p_need_edit)           -- "am I a sharee?"
--
-- The first is a question a caller can point at anyone. The second reads
-- auth.uid() inside the function, which comes from the request JWT rather than
-- from any table, so it is unaffected by the definer rights the function runs
-- with — and there is no argument left to aim at somebody else. It answers the
-- caller's own access and nothing else, which is all a policy ever needed.
--
-- anon calling it gets auth.uid() = NULL, the subquery matches nothing, and it
-- returns false. Anonymous public-note reads work again and the probe is closed
-- more tightly than before, not less.

create or replace function public.owns_note(p_note_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.notebook_notes n
    where n.id = p_note_id and n.owner_id = (select auth.uid())
  );
$$;

create or replace function public.note_shared_with(
  p_note_id uuid, p_need_edit boolean default false
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.note_shares s
    where s.note_id = p_note_id
      and s.shared_with = (select auth.uid())
      and (not p_need_edit or s.can_edit)
  );
$$;

revoke all on function public.owns_note(uuid) from public;
revoke all on function public.note_shared_with(uuid, boolean) from public;
grant execute on function public.owns_note(uuid) to anon, authenticated, service_role;
grant execute on function public.note_shared_with(uuid, boolean) to anon, authenticated, service_role;

drop policy if exists "Shared notes readable" on public.notebook_notes;
create policy "Shared notes readable" on public.notebook_notes for select
  using (public.note_shared_with(id, false));

drop policy if exists "Owners and editors can update notes" on public.notebook_notes;
create policy "Owners and editors can update notes" on public.notebook_notes for update
  using (((select auth.uid()) = owner_id) or public.note_shared_with(id, true))
  with check (((select auth.uid()) = owner_id) or public.note_shared_with(id, true));

drop policy if exists "Owners manage shares" on public.note_shares;
create policy "Owners manage shares" on public.note_shares
  using (public.owns_note(note_id))
  with check (public.owns_note(note_id));

comment on function public.owns_note(uuid) is
  'Definer so note_shares policies do not re-enter notebook_notes RLS (that was an infinite loop). Takes no user argument on purpose: it answers only about the caller.';
comment on function public.note_shared_with(uuid, boolean) is
  'Definer, for the same reason. p_need_edit = false means any share; true requires can_edit.';
