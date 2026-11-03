-- First-run state for onboarding and the product walkthrough.
--
-- onboarded_at:      set when the first-run setup is finished or skipped.
--                    Null means the app shows the setup on the next /home
--                    visit (social signups skip the Join form's questions).
-- tour_completed_at: set when the walkthrough is finished or dismissed; the
--                    profile page can clear it to replay the tour.
--
-- Both are written only by PATCH /api/auth/profile (service role), so no
-- UPDATE grant. SELECT goes to authenticated only: the app reads them for the
-- signed-in user's own profile; anonymous visitors never need them.

alter table public.profiles
  add column if not exists onboarded_at timestamptz,
  add column if not exists tour_completed_at timestamptz;

comment on column public.profiles.onboarded_at is
  'First-run setup finished or skipped. Null = show it on the next /home visit.';
comment on column public.profiles.tour_completed_at is
  'Walkthrough finished or dismissed. Null = show it once onboarded_at is set.';

grant select (onboarded_at, tour_completed_at) on public.profiles to authenticated;
