-- Fix: /u/[username] 404s for every username containing a capital letter.
--
-- lib/data/profilePublic.ts and lib/data/journey.ts both did
--
--     .eq("username", username.toLowerCase())
--
-- while profiles.username is stored with whatever case the member typed. So the
-- stored value "Prem Sai" is unreachable by either spelling: /u/Prem%20Sai
-- lowercases to "prem sai" and misses, and there is no lookup anywhere that
-- matches the stored casing either. Verified on the live site:
--
--     /u/prajwal     -> 200     (already lowercase)
--     /u/Prem%20Sai  -> 404
--     /u/prem%20sai  -> 404
--
-- A public profile is not a nice-to-have. Step 22's §22 dimensions, the teaching
-- list, follows, referrals and "who recruited you" all hang off this page, so a
-- member with a capital in their name had no public presence at all.
--
-- lib/data/notebook.ts had the mirror-image bug: shareNoteWith matched the typed
-- string exactly, so sharing with "@Prem Sai" worked and "@prem sai" reported
-- "No member named @prem sai".
--
-- The codebase already solved this once, for leetcode_username — a normalize
-- trigger plus a lower() unique index — and then forgot to do it for username.
-- This is that same treatment: a stored generated column, indexed and unique, so
-- the lookup is both correct and case-insensitively unique.
--
-- The unique index also closes a hole: `username text unique` is case-SENSITIVE,
-- so "Alice" and "alice" were two different accounts. There are no existing
-- collisions, so the index applies without a data fix.
--
-- Every lookup now goes through lib/profiles/username.ts, because three
-- hand-written variants of "find a profile by name" is how the divergence
-- happened in the first place.

alter table public.profiles
  add column if not exists username_lower text
  generated always as (lower(username)) stored;

create unique index if not exists profiles_username_lower_unique
  on public.profiles using btree (username_lower);

comment on column public.profiles.username_lower is
  'Generated, so username stays exactly as typed for display while every lookup is case-insensitive. Index is unique: "Alice" and "alice" are one account.';

-- Enforce at write time too. Without the trigger, someone inserting "Alice"
-- directly would succeed (case-SENSITIVE unique) and break the index above.
create or replace function public.normalize_username_case()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id <> new.id and lower(p.username) = lower(new.username)
  ) then
    raise exception 'That username is taken: %', new.username using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_username_case_unique on public.profiles;
create trigger profiles_username_case_unique
  before insert or update of username on public.profiles
  for each row execute function public.normalize_username_case();
