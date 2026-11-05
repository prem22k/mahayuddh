-- /validation is the team's research board: every squad's name, the gate
-- verdicts per squad, and the observation log. Its three RPCs were granted to
-- anon and authenticated, so anyone, signed out included, could list every
-- squad and read its activity. Make them product-admin only.
--
-- assert_product_admin() raises 42501 for a browser caller (role anon or
-- authenticated) who isn't a product admin. Server callers (service_role, the
-- SQL editor) pass, same rule as guard_product_admin. Function bodies are
-- unchanged apart from the guard as their first statement.
--
-- To give someone access, run in the SQL editor (guard_product_admin only
-- lets the service role change the flag):
--   begin;
--   set local role service_role;
--   update public.profiles set is_product_admin = true where username = '<name>';
--   commit;

create or replace function public.assert_product_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('role', true), '') in ('anon', 'authenticated')
     and not exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.is_product_admin
     ) then
    raise exception 'product admins only' using errcode = '42501';
  end if;
end $$;

revoke all on function public.assert_product_admin() from public, anon, authenticated;

create or replace function public.validation_gate_board(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select public.assert_product_admin();
  select * from public.gate_activation(p_squad_id)
  union all select * from public.gate_social(p_squad_id)
  union all select * from public.gate_learning(p_squad_id)
  union all select * from public.gate_retention(p_squad_id)
  union all select * from public.gate_organic(p_squad_id)
$$;

create or replace function public.validation_test_status(p_squad_id uuid default null)
returns table (member_count bigint, observation_count bigint, squad_count bigint)
language sql stable security definer set search_path = public as $$
  select public.assert_product_admin();
  select
    (select count(*) from public.squad_members m
      where public.validation_scope_has(p_squad_id, m.squad_id)),
    (select count(*) from public.validation_observations o
      where p_squad_id is null or o.squad_id = p_squad_id),
    (select count(distinct m.squad_id) from public.squad_members m
      where public.validation_scope_has(p_squad_id, m.squad_id))
$$;

create or replace function public.validation_squads()
returns table (squad_id uuid, name text, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select public.assert_product_admin();
  select s.id, s.name, s.is_demo
  from public.squads s
  where exists (select 1 from public.squad_members m where m.squad_id = s.id)
  order by s.is_demo, s.name
$$;

-- Signed-out visitors can't call them at all; signed-in non-admins get 42501.
revoke all on function public.validation_gate_board(uuid) from public, anon;
revoke all on function public.validation_test_status(uuid) from public, anon;
revoke all on function public.validation_squads() from public, anon;
grant execute on function public.validation_gate_board(uuid) to authenticated, service_role;
grant execute on function public.validation_test_status(uuid) to authenticated, service_role;
grant execute on function public.validation_squads() to authenticated, service_role;

-- The gate functions and the scope helper are only called from the RPCs
-- above (as their owner). Keep them closed to browsers.
revoke all on function public.gate_activation(uuid) from public, anon, authenticated;
revoke all on function public.gate_social(uuid) from public, anon, authenticated;
revoke all on function public.gate_learning(uuid) from public, anon, authenticated;
revoke all on function public.gate_retention(uuid) from public, anon, authenticated;
revoke all on function public.gate_organic(uuid) from public, anon, authenticated;
revoke all on function public.validation_scope_has(uuid, uuid) from public, anon, authenticated;

-- The observation log feeds observation_count, so only the team writes to it.
drop policy if exists "Researchers write observations" on public.validation_observations;
create policy "Researchers write observations" on public.validation_observations for insert
  with check (
    (select auth.uid()) = observed_by
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin)
  );
