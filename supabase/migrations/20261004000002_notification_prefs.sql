-- Server-side notification preferences (own rows only).
--
-- The profile page stored toggles in localStorage ("saved on this device"),
-- so a preference set on desktop never reached the phone. This table owns the
-- five preference keys; localStorage stays as an offline fallback only.

create table if not exists public.user_notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean default true not null,
  challenge boolean default true not null,
  squad boolean default true not null,
  practice boolean default true not null,
  contests boolean default true not null,
  updated_at timestamptz default now()
);

alter table public.user_notification_prefs enable row level security;

-- Private preference data: own rows only, all operations.
drop policy if exists "Users manage own notification prefs" on public.user_notification_prefs;
create policy "Users manage own notification prefs" on public.user_notification_prefs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
