-- Follow-up to 20261003000000: profiles.objective (plan Step 3 onboarding field).
-- Intent signal only, never a skill assessment (no test, no score, §22).
-- NULL = not chosen yet; the Practice hub treats that as "no preference".

alter table public.profiles add column if not exists objective text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_objective_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_objective_check
      check (objective is null or objective in ('internship', 'fulltime', 'consistency'));
  end if;
end $$;

-- Keep the legacy `note` column and the v2 `message` column in lockstep so a
-- reader using either name sees the same text. Both are free-text (deliberately
-- NOT locked by lock_suggestion_parties), so the sync runs on insert + update.
create or replace function public.sync_suggestion_message()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.message is null and new.note is not null then
      new.message := new.note;
    elsif new.note is null and new.message is not null then
      new.note := new.message;
    end if;
  else
    if new.message is distinct from old.message then
      new.note := new.message;
    elsif new.note is distinct from old.note then
      new.message := new.note;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists sync_suggestion_message on public.suggestions;
create trigger sync_suggestion_message
  before insert or update on public.suggestions
  for each row execute function public.sync_suggestion_message();

update public.suggestions set message = note where message is null and note is not null;
update public.suggestions set note = message where note is null and message is not null;

-- notifications.dedupe_key: one open notice per (user, kind, key) so a goal
-- nudge can never stack (Bible §37: low noise, action-oriented).
alter table public.notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_open_unique
  on public.notifications (user_id, kind, dedupe_key)
  where dedupe_key is not null and read_at is null;

-- Reminder throttle read path (mirrors public.suggestion_remind_allowed()).
create index if not exists suggestions_reminded_idx
  on public.suggestions (reminded_at) where reminded_at is not null;