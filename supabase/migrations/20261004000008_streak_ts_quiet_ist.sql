-- Wave A leftovers: streak timestamp + IST quiet hours.
--
-- 1. profiles.streak_updated_at: the sync route stamps it on successful
--    streak writes so "stale vs reset" is answerable. Nullable: old rows
--    simply have no stamp, and the route already retries without the column
--    on undefined-column errors (pre-migration DBs keep working).
-- 2. in_quiet_hours(): was UTC 22:00-08:00, which suppresses 03:30-13:30 IST
--    (morning study peak) and allows the IST night. Squad-local default is
--    Asia/Kolkata until per-user tz lands: 22:00-08:00 IST = 16:30-02:30Z.
--    Signature and volatility unchanged; callers unaffected.

alter table public.profiles
  add column if not exists streak_updated_at timestamptz;

-- NOTE: keeps the existing DEFAULT now() — dropping a parameter default
-- via OR REPLACE is rejected (42P13), and callers rely on the default.
create or replace function public.in_quiet_hours(p_at timestamptz default now())
returns boolean
language sql stable
set search_path = public
as $$
  -- Quiet hours in squad-local default (Asia/Kolkata, no DST):
  -- 22:00-08:00 IST. p_at carries its instant; only the wall-clock reading
  -- changes vs the old UTC version.
  select (extract(hour from p_at at time zone 'Asia/Kolkata') >= 22
       or extract(hour from p_at at time zone 'Asia/Kolkata') < 8);
$$;
comment on function public.in_quiet_hours(timestamptz) is
  'Batchable notification kinds (goal/recap/contest) are suppressed 22:00-08:00 squad-local (default Asia/Kolkata). Direct challenges bypass by design.';
