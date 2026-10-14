-- Phase 1 Step 5: Squads core (Bible §26-28, §35, §66).
-- Schema: MANY squads per user. UX: ONE active squad at a time (profiles.active_squad_id).
-- Solo users unaffected: active_squad_id nullable, everything degrades to empty states.

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  avatar_url text,
  description text check (description is null or octet_length(description) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  invite_code text unique not null,
  shared_goal_text text,
  season_name text,
  created_at timestamp with time zone default now()
);

create table if not exists public.squad_members (
  squad_id uuid references public.squads(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('admin', 'member')) default 'member' not null,
  joined_at timestamp with time zone default now(),
  last_active_at timestamp with time zone default now(),
  primary key (squad_id, user_id)
);

create table if not exists public.squad_goals (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade not null,
  title text not null check (char_length(title) between 1 and 120),
  target_count int not null check (target_count between 1 and 10000),
  pattern text,
  deadline date,
  status text check (status in ('active', 'completed')) default 'active' not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table public.profiles add column if not exists active_squad_id uuid references public.squads(id) on delete set null;
create index if not exists squad_members_user_idx on public.squad_members (user_id);
create index if not exists squad_members_squad_idx on public.squad_members (squad_id);
create index if not exists squad_goals_squad_idx on public.squad_goals (squad_id) where status = 'active';

-- Short invite codes: 8 chars, unambiguous alphabet (no 0/O/1/l).
create or replace function public.generate_squad_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alphabet, (random() * 31)::int + 1, 1);
  end loop;
  return code;
end $$;

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.squad_goals enable row level security;

-- Squads are accountability groups: public read (invite preview + counts),
-- creator-admin writes. First member model: creator becomes admin via API.
create policy "Squads publicly readable" on public.squads for select using (true);
create policy "Users can create squads" on public.squads for insert
  with check ((select auth.uid()) = created_by);
create policy "Squad creator can update" on public.squads for update
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
create policy "Squad creator can delete" on public.squads for delete
  using ((select auth.uid()) = created_by);

-- Membership lists visible (accountability). No client INSERT: joins go through
-- POST /api/squads/join which validates the invite code server-side; otherwise
-- anyone could self-add to any squad by id.
create policy "Squad members publicly readable" on public.squad_members for select using (true);
create policy "Members can leave, creator can remove" on public.squad_members for delete
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.squads where squads.id = squad_id and squads.created_by = (select auth.uid()))
  );

-- Goals: any member manages; readable by all (progress is the point).
create policy "Squad goals publicly readable" on public.squad_goals for select using (true);
create policy "Squad members can create goals" on public.squad_goals for insert
  with check (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id and squad_members.user_id = (select auth.uid())
  ));
create policy "Squad members can manage goals" on public.squad_goals for update
  using (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id and squad_members.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id and squad_members.user_id = (select auth.uid())
  ));
create policy "Squad members can delete goals" on public.squad_goals for delete
  using (exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_id and squad_members.user_id = (select auth.uid())
  ));
