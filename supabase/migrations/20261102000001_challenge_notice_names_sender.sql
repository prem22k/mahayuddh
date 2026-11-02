-- The challenge notice names who sent it.
--
-- The composer used to insert its own "@user challenged you" row next to this
-- trigger's "Someone challenged you", so every challenge reached the recipient
-- twice. /api/notify now skips its insert when this row exists (it still sends
-- the immediate push), which makes this the only row, so it carries the
-- sender's handle the way the composer's did.
create or replace function public.notify_challenge_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, deep_link, actor_id, dedupe_key)
  values (
    new.to_user,
    'challenge',
    coalesce('@' || (select username from public.profiles where id = new.from_user), 'Someone')
      || ' challenged you',
    coalesce(new.problem_title, 'A problem') || ' — beat their time or take it on.',
    '/c/' || new.id::text,
    new.from_user,
    'challenge:' || new.id::text
  )
  on conflict do nothing;

  -- §37: a challenge is one of the two explicitly good notifications and it is
  -- directed at one person, so it ignores quiet hours.
  return new;
end $$;
