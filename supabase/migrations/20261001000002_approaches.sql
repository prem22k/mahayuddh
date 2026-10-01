-- Phase 1 Step 9: approaches (Bible §13, §15). Approach = AFTER solving.
-- Private by default; sharing intentional + reversible (Bible Principle 6).

create table if not exists public.approaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_slug text not null check (problem_slug ~ '^[a-z0-9-]{1,80}$'),
  pattern text,
  core_idea text not null check (char_length(core_idea) between 1 and 5000),
  complexity_time text,
  complexity_space text,
  key_detail text,
  edge_cases text,
  mistakes text,
  code text check (code is null or octet_length(code) <= 20000),
  related_slugs text[] default '{}',
  visibility text check (visibility in ('private', 'squad', 'public')) default 'private' not null,
  squad_id uuid references public.squads(id) on delete set null,
  fork_of uuid references public.approaches(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists approaches_slug_idx on public.approaches (problem_slug, created_at desc);
create index if not exists approaches_user_idx on public.approaches (user_id, created_at desc);

alter table public.approaches enable row level security;

-- Own rows always visible to owner. Squad rows visible to squad members.
-- Public rows visible to all. Insert/update/delete: owner only.
create policy "Owners see own approaches" on public.approaches for select
  using ((select auth.uid()) = user_id);
create policy "Squad members see squad approaches" on public.approaches for select
  using (
    visibility = 'squad' and squad_id is not null and exists (
      select 1 from public.squad_members
      where squad_members.squad_id = approaches.squad_id
      and squad_members.user_id = (select auth.uid())
    )
  );
create policy "Public approaches readable" on public.approaches for select
  using (visibility = 'public');
create policy "Users can create approaches" on public.approaches for insert
  with check ((select auth.uid()) = user_id);
create policy "Owners can update approaches" on public.approaches for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Owners can delete approaches" on public.approaches for delete
  using ((select auth.uid()) = user_id);
