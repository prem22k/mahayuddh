-- Step 27 — open the §60 triage queue to proposals, keep labels admin-only.
--
-- 20261003000029 put "Admins decide triage" as a single `for all` policy, so a
-- non-admin could not even ADD a proposal to the queue — only an admin could.
-- That is wrong on the plan's own terms. §60: "Every proposed feature gets one of
-- these labels." Proposals come from whoever notices something; the label is the
-- commitment. With the queue admin-only, the researcher running the two-week test
-- — the person whose observations feed it — could not file the request they heard
-- three times in one afternoon.
--
-- So:
--   INSERT  any signed-in user, label forced NULL
--   UPDATE  admin only (the nine fields travel with the label)
--   DELETE  admin only
--
-- The INSERT policy alone would let any client post label='CORE' directly, which
-- makes "a label is a commitment" untrue in a way the UI cannot prevent. So a
-- trigger refuses a non-null label on insert unless the writer is an admin — the
-- same shape as assert_referral_referrer_is_member, for the same reason: the rule
-- belongs in the database, not in the client that happens to be polite.

drop policy if exists "Admins decide triage" on public.feature_triage;
drop policy if exists "Admins label and revise triage" on public.feature_triage;
drop policy if exists "Members propose features" on public.feature_triage;

create policy "Members propose features" on public.feature_triage
  for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy "Admins label and revise triage" on public.feature_triage
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin));

create policy "Admins remove triage" on public.feature_triage
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin));

create or replace function public.assert_triage_label_needs_admin()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.label is not null and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_product_admin
  ) then
    raise exception 'Only a product admin can label a feature. Propose it and leave it undecided.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists feature_triage_label_needs_admin on public.feature_triage;
create trigger feature_triage_label_needs_admin
  before insert on public.feature_triage
  for each row execute function public.assert_triage_label_needs_admin();

comment on function public.assert_triage_label_needs_admin() is
  'Keeps §60''s "a label is a commitment" true against a direct API call, not just against the app.';

grant execute on function public.assert_triage_label_needs_admin() to authenticated;
