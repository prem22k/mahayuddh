-- Security fixes from the 2026-11-16 database audit.
--
-- Every finding below was reproduced on a local copy and confirmed present in
-- production with read-only checks (none had been used: 0 admins, 0 cross-squad
-- rows, 0 notes shared with editors). Nothing here changes or deletes a row;
-- only policies, grants, triggers and one function body change.

-- ── 1. A new account could create its own profile as product admin ─────────
-- The insert policy only checks auth.uid() = id, and authenticated holds
-- INSERT on every column, while guard_product_admin fires on UPDATE only. A
-- signup could insert is_product_admin = true and any streak, totals, rating,
-- LeetCode handle or referral credit it liked.
--
-- The app's own insert (app/api/auth/profile/route.ts) sends id, username and
-- avatar_url plus zeroed stats, so a client insert now keeps exactly those
-- three and every server-owned column starts from its safe value.
create or replace function public.sanitize_client_profile_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  new.is_product_admin := false;
  new.leetcode_username := null;
  new.leetcode_verified_at := null;
  new.leetcode_session_encrypted := null;
  new.leetcode_session_synced_at := null;
  new.contest_rating := null;
  new.contest_attended := 0;
  new.contest_global_rank := null;
  new.contest_top_percentage := null;
  new.global_rank := null;
  new.streak := 0;
  new.streak_updated_at := null;
  new.total_easy := 0;
  new.total_medium := 0;
  new.total_hard := 0;
  new.last_synced_at := now();
  new.created_at := now();
  new.active_squad_id := null;
  new.objective := null;
  new.invited_by := null;
  new.joined_via_referral := null;
  new.onboarded_at := null;
  new.tour_completed_at := null;
  return new;
end $$;

drop trigger if exists sanitize_client_profile_insert on public.profiles;
create trigger sanitize_client_profile_insert
  before insert on public.profiles
  for each row execute function public.sanitize_client_profile_insert();

-- ── 2. Any squad member could write to every squad's goals, seasons, recaps ─
-- The policies compared squad_members.squad_id with itself, which is always
-- true, so membership of any squad passed for all of them.
drop policy if exists "Squad members can create goals" on public.squad_goals;
create policy "Squad members can create goals" on public.squad_goals
  for insert with check (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_goals.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members can manage goals" on public.squad_goals;
create policy "Squad members can manage goals" on public.squad_goals
  for update
  using (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_goals.squad_id and m.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_goals.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members can delete goals" on public.squad_goals;
create policy "Squad members can delete goals" on public.squad_goals
  for delete using (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_goals.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members create seasons" on public.squad_seasons;
create policy "Squad members create seasons" on public.squad_seasons
  for insert with check (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_seasons.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members update seasons" on public.squad_seasons;
create policy "Squad members update seasons" on public.squad_seasons
  for update
  using (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_seasons.squad_id and m.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_seasons.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members delete seasons" on public.squad_seasons;
create policy "Squad members delete seasons" on public.squad_seasons
  for delete using (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_seasons.squad_id and m.user_id = (select auth.uid())));

drop policy if exists "Squad members create recaps" on public.squad_recaps;
create policy "Squad members create recaps" on public.squad_recaps
  for insert with check (exists (
    select 1 from public.squad_members m
    where m.squad_id = squad_recaps.squad_id and m.user_id = (select auth.uid())));

-- ── 3. Every squad's invite code was readable by anyone, signed in or not ──
-- The code is the squad's only join capability. Browsers keep every other
-- squad column; members get their own codes from my_squad_invite_codes().
-- Server routes read codes with the service role and are unaffected.
revoke select on public.squads from anon, authenticated;
grant select (id, name, avatar_url, description, created_by, shared_goal_text, season_name,
              created_at, ai_enabled, is_demo)
  on public.squads to anon, authenticated;

create or replace function public.my_squad_invite_codes()
returns table (squad_id uuid, invite_code text)
language sql stable security definer set search_path = public as $$
  select s.id, s.invite_code
  from public.squads s
  join public.squad_members m on m.squad_id = s.id
  where m.user_id = auth.uid()
$$;

revoke all on function public.my_squad_invite_codes() from public, anon;
grant execute on function public.my_squad_invite_codes() to authenticated;

-- ── 4. A note editor could take the note over ───────────────────────────────
-- Editors share the owner's UPDATE policy with no column limits, so an editor
-- could set owner_id to themselves or make a private note public. Who owns a
-- note, who can see it and where it was forked from stay the owner's call;
-- owner_id never changes from the app.
create or replace function public.guard_note_owner_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'A note''s owner cannot be changed';
  end if;
  if (select auth.uid()) is distinct from old.owner_id and (
       new.visibility is distinct from old.visibility
       or new.squad_id is distinct from old.squad_id
       or new.fork_of is distinct from old.fork_of
       or new.fork_of_type is distinct from old.fork_of_type
       or new.fork_from is distinct from old.fork_from) then
    raise exception 'Only the owner can change who sees a note or where it came from';
  end if;
  return new;
end $$;

drop trigger if exists guard_note_owner_fields on public.notebook_notes;
create trigger guard_note_owner_fields
  before update on public.notebook_notes
  for each row execute function public.guard_note_owner_fields();

-- ── 5. Writes that skipped the checks the app makes ─────────────────────────
-- a) Challenges: the app completes a challenge only as its recipient, after
--    they marked the problem solved (lib/data/suggestions.ts). The sender
--    could complete their own, which credits challenge completions in
--    teacher_stats. Battles still complete it through
--    complete_challenge_from_battle, which does not run as a client role.
create or replace function public.guard_suggestion_completion()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if (select auth.uid()) is distinct from old.to_user
       or not exists (
         select 1 from public.user_problem_status s
         where s.user_id = old.to_user and s.problem_slug = old.problem_slug and s.status = 'solved') then
      raise exception 'Only the person challenged can complete it, after solving the problem';
    end if;
  elsif new.completed_at is distinct from old.completed_at then
    raise exception 'completed_at is set when a challenge is completed';
  end if;
  return new;
end $$;

drop trigger if exists guard_suggestion_completion on public.suggestions;
create trigger guard_suggestion_completion
  before update on public.suggestions
  for each row execute function public.guard_suggestion_completion();

-- b) Stuck replies: only the person who asked accepts an answer, and a reply's
--    help level is fixed once the ladder check on insert has passed.
create or replace function public.guard_stuck_reply_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.level is distinct from old.level then
    raise exception 'A reply''s help level cannot be changed after posting';
  end if;
  if new.accepted is distinct from old.accepted and not exists (
       select 1 from public.stuck_requests r
       where r.id = old.request_id and r.user_id = (select auth.uid())) then
    raise exception 'Only the person who asked can accept an answer';
  end if;
  return new;
end $$;

drop trigger if exists guard_stuck_reply_update on public.stuck_replies;
create trigger guard_stuck_reply_update
  before update on public.stuck_replies
  for each row execute function public.guard_stuck_reply_update();

-- c) Feed events and discussions could be written into any squad. For feed
--    events, restrictive policies add membership on top of the existing
--    own-row policies; reads are untouched.
drop policy if exists "Users can insert feed events" on public.feed_events; -- duplicate of "Users can create own feed events"

create policy "Squad feed events come from members" on public.feed_events
  as restrictive for insert
  with check (squad_id is null or exists (
    select 1 from public.squad_members m
    where m.squad_id = feed_events.squad_id and m.user_id = (select auth.uid())));

create policy "Squad feed events stay with members" on public.feed_events
  as restrictive for update
  using (true)
  with check (squad_id is null or exists (
    select 1 from public.squad_members m
    where m.squad_id = feed_events.squad_id and m.user_id = (select auth.uid())));

-- Discussions are created both directly and through create_discussion, which
-- runs as its owner and so skips policies; a trigger covers both paths.
create or replace function public.discussion_squad_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.squad_id is not null and not exists (
       select 1 from public.squad_members m
       where m.squad_id = new.squad_id and m.user_id = new.author_id) then
    raise exception 'Post to a squad you are in.';
  end if;
  return new;
end $$;

drop trigger if exists discussion_squad_guard on public.discussions;
create trigger discussion_squad_guard
  before insert or update of squad_id on public.discussions
  for each row execute function public.discussion_squad_guard();

-- ── 6. content_impact showed forks inside private notes ─────────────────────
-- 20261004000003 kept both views at owner rights on the grounds that they
-- expose "only counts plus already-public usernames". That holds for
-- teacher_stats, which stays as it is. content_impact returns one row per
-- fork (who forked what, the problem, when they solved it), including forks
-- into private notes, readable signed out. It now reads as the caller, so the
-- notebook policies apply. The undercount that decision avoided does not
-- happen: a creator's own totals come from my_content_impact(), which runs as
-- its owner and still counts private forks (checked: "1 copy" for a private
-- fork, while the view itself no longer lists that row).
alter view public.content_impact set (security_invoker = true);
revoke insert, update, delete, truncate on public.content_impact, public.teacher_stats from anon, authenticated;
