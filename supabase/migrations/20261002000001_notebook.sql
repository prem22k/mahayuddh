-- Phase 2 Step 13: notebook vs vault split (Bible §16, §47, §65).
-- Vault = shared / reusable. Notebook = personal knowledge.
-- Markdown is sufficient; list views exclude bodies; no FTS until justified.

alter table public.shared_resources
  add column if not exists visibility text default 'public' not null
    check (visibility in ('squad', 'public')),
  add column if not exists squad_id uuid references public.squads(id) on delete set null,
  add column if not exists fork_of uuid;

-- Existing vault rows were public-read: keep them public honestly.
update public.shared_resources set visibility = 'public' where visibility is null;

-- Vault reads now respect visibility (was: blanket public read).
drop policy if exists "Allow public read access for resources" on public.shared_resources;
create policy "Public vault readable" on public.shared_resources
  for select using (visibility = 'public');
create policy "Squad vault readable" on public.shared_resources
  for select using (
    visibility = 'squad' and squad_id is not null and exists (
      select 1 from public.squad_members
      where squad_members.squad_id = shared_resources.squad_id
      and squad_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert shared resources" on public.shared_resources;
create policy "Users can insert shared resources" on public.shared_resources
  for insert with check (
    (select auth.uid()) = author_id
    and visibility in ('public', 'squad')
    and (visibility = 'public' or (
      squad_id is not null and exists (
        select 1 from public.squad_members
        where squad_members.squad_id = shared_resources.squad_id
        and squad_members.user_id = (select auth.uid())
      )
    ))
  );

create table if not exists public.notebook_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  folder text,
  pattern_tags text[] default '{}' not null,
  problem_slug text check (problem_slug is null or problem_slug ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (char_length(title) between 1 and 120),
  body_md text not null check (octet_length(body_md) <= 50000),
  visibility text check (visibility in ('private', 'squad', 'public')) default 'private' not null,
  squad_id uuid references public.squads(id) on delete set null,
  fork_of uuid,
  fork_from text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists notebook_owner_idx on public.notebook_notes (owner_id, updated_at desc);
create index if not exists notebook_squad_idx on public.notebook_notes (squad_id) where visibility = 'squad';

create table if not exists public.note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notebook_notes(id) on delete cascade not null,
  shared_with uuid references public.profiles(id) on delete cascade not null,
  can_edit boolean default false not null,
  created_at timestamp with time zone default now(),
  unique (note_id, shared_with)
);

alter table public.notebook_notes enable row level security;
alter table public.note_shares enable row level security;

-- Private first: owner always sees own. Public readable. Squad visible to members.
-- 1:1 shares visible to the recipient.
create policy "Owners see own notes" on public.notebook_notes for select
  using ((select auth.uid()) = owner_id);
create policy "Public notes readable" on public.notebook_notes for select
  using (visibility = 'public');
create policy "Squad notes readable" on public.notebook_notes for select
  using (
    visibility = 'squad' and squad_id is not null and exists (
      select 1 from public.squad_members
      where squad_members.squad_id = notebook_notes.squad_id
      and squad_members.user_id = (select auth.uid())
    )
  );
create policy "Shared notes readable" on public.notebook_notes for select
  using (exists (
    select 1 from public.note_shares
    where note_shares.note_id = notebook_notes.id
    and note_shares.shared_with = (select auth.uid())
  ));
create policy "Users can create notes" on public.notebook_notes for insert
  with check (
    (select auth.uid()) = owner_id
    and visibility in ('private', 'squad', 'public')
    and (visibility != 'squad' or (
      squad_id is not null and exists (
        select 1 from public.squad_members
        where squad_members.squad_id = notebook_notes.squad_id
        and squad_members.user_id = (select auth.uid())
      )
    ))
  );
create policy "Owners and editors can update notes" on public.notebook_notes for update
  using (
    (select auth.uid()) = owner_id
    or exists (
      select 1 from public.note_shares
      where note_shares.note_id = notebook_notes.id
      and note_shares.shared_with = (select auth.uid())
      and note_shares.can_edit = true
    )
  )
  with check (
    (select auth.uid()) = owner_id
    or exists (
      select 1 from public.note_shares
      where note_shares.note_id = notebook_notes.id
      and note_shares.shared_with = (select auth.uid())
      and note_shares.can_edit = true
    )
  );
create policy "Owners can delete notes" on public.notebook_notes for delete
  using ((select auth.uid()) = owner_id);

-- Shares: note owner manages; recipient sees own shares.
create policy "Owners manage shares" on public.note_shares for all
  using (exists (
    select 1 from public.notebook_notes
    where notebook_notes.id = note_shares.note_id
    and notebook_notes.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.notebook_notes
    where notebook_notes.id = note_shares.note_id
    and notebook_notes.owner_id = (select auth.uid())
  ));
create policy "Recipients see own shares" on public.note_shares for select
  using ((select auth.uid()) = shared_with);
