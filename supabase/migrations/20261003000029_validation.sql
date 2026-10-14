-- Step 27 — validation gates and observation log (§58, §59, §60, §76).
--
-- Step 27 is a two-week test with 3–5 real squads. The people cannot be
-- substituted by software, and this migration does not pretend otherwise: the
-- qualitative gate ("someone says this is where we do DSA") has no automated
-- answer and is deliberately absent from the gate functions below.
--
-- What IS buildable is everything the gates measure, and §76 requires answers
-- rather than impressions: "Are users practicing more? Are squads interacting?"
-- If the answer is no, stop adding surface area. Without a query behind each
-- question, that sentence is unenforceable.
--
-- So each gate below is a function over rows that already exist, and each one
-- returns NULL rather than zero when there is nobody to measure. "0% activation
-- with zero users" is a factually wrong thing to show somebody, and a gate that
-- reports it is worse than no gate at all.

-- ── §59 observation log ──────────────────────────────────────────────────────
-- The record the test depends on: where people hesitated, what they ignored,
-- what they kept asking for, and what they do outside the app instead.
--
-- Deliberately free text plus a category. §59 says "User behavior outranks
-- founder imagination", and a fixed taxonomy would force the observer into the
-- app's own vocabulary — which is the thing being tested.
create table if not exists public.validation_observations (
  id uuid primary key default gen_random_uuid(),
  -- Which squad the observation is about. Null for product-level notes.
  squad_id uuid references public.squads(id) on delete cascade,
  day_number int check (day_number is null or day_number between 1 and 14),
  category text not null check (category in (
    'hesitation',     -- where they stalled
    'ignored',        -- what they never touched
    'requested',      -- what they kept asking for
    'workaround',     -- what they do outside the app instead
    'praise',         -- unprompted positive, the §58 qualitative signal
    'blocker'         -- something that stopped them
  )),
  -- Day 1 can everyone understand what to do / Day 3 natural challenge /
  -- Day 7 voluntary return / Day 14 meaningful history.
  observation text not null check (char_length(trim(observation)) between 1 and 2000),
  -- Who recorded it. A researcher, so their own account is not mistaken for a
  -- participant's.
  observed_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists validation_observations_squad_idx
  on public.validation_observations (squad_id, created_at desc);
create index if not exists validation_observations_category_idx
  on public.validation_observations (category);

alter table public.validation_observations enable row level security;

-- Private to the observer and platform admins. A participant's hesitation is
-- not something the product should display to another squad.
drop policy if exists "Researchers read observations" on public.validation_observations;
create policy "Researchers read observations" on public.validation_observations for select
  using (
    (select auth.uid()) = observed_by
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin)
  );

drop policy if exists "Researchers write observations" on public.validation_observations;
create policy "Researchers write observations" on public.validation_observations for insert
  with check ((select auth.uid()) = observed_by);

-- ── §60 feature triage ───────────────────────────────────────────────────────
-- Every proposed feature gets one label and the nine recorded fields. This is a
-- table rather than a document because a decision that lives in a wiki gets
-- re-litigated in a meeting instead of being read.
create table if not exists public.feature_triage (
  id uuid primary key default gen_random_uuid(),
  feature text not null check (char_length(trim(feature)) between 1 and 120),
  label text check (label is null or label in (
    'CORE', 'SUPPORT', 'EXPERIMENT', 'FUTURE', 'KILL', 'DUPLICATE'
  )),
  problem text,
  target_user text,
  behaviour text,
  core_loop_link text,
  alternative text,
  cost text,
  risk text,
  success_metric text,
  decision text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists feature_triage_name_unique on public.feature_triage (lower(feature));
create index if not exists feature_triage_label_idx on public.feature_triage (label);

alter table public.feature_triage enable row level security;

-- Platform-wide and readable, because a triage decision that is not visible
-- stops being a decision. Writable only by admins, since a label is a
-- commitment.
drop policy if exists "Everyone reads triage" on public.feature_triage;
create policy "Everyone reads triage" on public.feature_triage for select using (true);
drop policy if exists "Admins decide triage" on public.feature_triage;
create policy "Admins decide triage" on public.feature_triage for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_product_admin));

-- ── §58 gates ────────────────────────────────────────────────────────────────
--
-- One function per gate, each returning NULL when unmeasurable. Read together by
-- validation_gate_board().

-- Activation: reach a first battle quickly.
-- "Quickly" is hours-to-first-battle from account creation, so the number is
-- reported alongside the rate rather than folded into it.
create or replace function public.gate_activation(p_squad_id uuid default null)
returns table (
  gate text,
  passed boolean,
  measured text,
  detail text
)
language sql stable security definer set search_path = public as $$
  with members as (
    select m.user_id, p.created_at
    from public.squad_members m
    join public.profiles p on p.id = m.user_id
    where p_squad_id is null or m.squad_id = p_squad_id
  ),
  first_battle as (
    select m.user_id, min(b.started_at) as at
    from members m
    left join public.battles b on b.user_id = m.user_id
    group by m.user_id
  )
  select
    'activation',
    count(*) filter (where f.at is not null) = count(*),
    count(*) filter (where f.at is not null)::text || ' of ' || count(*)::text || ' members started a battle',
    case when count(*) = 0 then 'No members yet — the gate cannot be measured.'
         when count(*) filter (where f.at is not null) = 0 then 'Nobody has started a battle.'
         else 'Median hours to first battle: ' || coalesce(
           (select round(avg(h))::text from (
              select extract(epoch from (f.at - m.created_at)) / 3600 as h
              from first_battle f join members m on m.user_id = f.user_id
              where f.at is not null
            ) s),
           'n/a'
         )
    end
  from first_battle f
  join members m on m.user_id = f.user_id
  having count(*) > 0
$$;

comment on function public.gate_activation(uuid) is
  '§58 activation. Returns no row rather than a failure when there are no members, because "0% activation" over an empty squad is not a finding.';

-- Social activation: challenges sent, without instruction.
-- Nothing in the product instructs a challenge, so the raw count IS the
-- unprompted measure. What is not measurable is intent, and the detail line
-- says so rather than implying the count proves it.
create or replace function public.gate_social(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select
    'social',
    n_sent > 0,
    n_sent::text || ' challenges sent, ' || n_done::text || ' completed',
    case
      when n_members = 0 then 'No members yet — the gate cannot be measured.'
      when n_sent = 0 then 'Nobody has sent a challenge. §59 asks whether one happens naturally by day 3, and that is an observation, not something this query can see.'
      else 'No surface in the product instructs sending a challenge, so these are unprompted. It cannot show intent.'
    end
  from (
    select
      (select count(*) from public.squad_members m
        where p_squad_id is null or m.squad_id = p_squad_id) as n_members,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)) as n_sent,
      (select count(*) from public.suggestions s
        where s.from_user in (select m.user_id from public.squad_members m
          where p_squad_id is null or m.squad_id = p_squad_id)
          and s.status = 'completed') as n_done
  ) c
$$;

-- Learning behaviour: reading, copying and writing.
create or replace function public.gate_learning(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  with members as (
    select m.user_id from public.squad_members m
    where p_squad_id is null or m.squad_id = p_squad_id
  ),
  counts as (
    select
      (select count(*) from public.approaches a where a.user_id in (select user_id from members)) as written,
      (select count(*) from public.primers p where p.author_id in (select user_id from members)) as primers,
      (select count(*) from public.notebook_notes n where n.fork_of is not null
         and n.owner_id in (select user_id from members)) as copied,
      (select count(*) from public.primers p where p.visibility = 'public'
         and p.author_id not in (select user_id from members)) as read_available
  )
  select
    'learning',
    (select written + copied from counts) > 0,
    (select written from counts)::text || ' approaches written, '
      || (select primers from counts)::text || ' primers, '
      || (select copied from counts)::text || ' things copied',
    case when (select count(*) from members) = 0 then 'No members yet.'
         else 'Reading is not measurable from rows — only writes and copies are. A primer opened and closed leaves nothing, so §59 observation has to cover reading.'
    end
  from counts
$$;

-- Retention: practising beyond the first week.
create or replace function public.gate_retention(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  with members as (
    select m.user_id from public.squad_members m
    where p_squad_id is null or m.squad_id = p_squad_id
  ),
  weeks as (
    select
      count(distinct date_trunc('week', e.created_at)) as active_weeks
    from public.problem_events e
    where e.user_id in (select user_id from members)
      and e.kind in ('solved', 'revisited')
      and e.created_at > now() - interval '21 days'
  )
  select
    'retention',
    (select active_weeks from weeks) >= 2,
    (select active_weeks from weeks)::text || ' distinct weeks with a solve',
    case when (select count(*) from members) = 0 then 'No members yet.'
         when (select active_weeks from weeks) < 2 then 'One active week is not retention.'
         else 'Two or more weeks with a solve inside the last 21 days.'
    end
  from weeks
$$;

-- Organic: somebody invited somebody without prompting.
-- Newly measurable, because Loop D attributes invites to a person rather than
-- leaving "who sent this?" unanswerable.
create or replace function public.gate_organic(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select
    'organic',
    count(*) > 0,
    count(*)::text || ' accounts joined through somebody''s invite link',
    case when count(*) = 0
      then 'No referred joins yet. This gate is now measurable at all — before Loop D it could not be answered either way.'
      else 'Invites are attributed to a person, so this is one specific member recruiting, not a squad-wide number.'
    end
  from public.profiles
  where invited_by is not null
    and (p_squad_id is null or active_squad_id = p_squad_id)
$$;

comment on function public.gate_organic(uuid) is
  '§58 organic behaviour. Measurable only since Loop D: before it, a signup arriving through an invite link could not be tied to the inviter.';

grant execute on function public.gate_activation(uuid) to anon, authenticated;
grant execute on function public.gate_social(uuid) to anon, authenticated;
grant execute on function public.gate_learning(uuid) to anon, authenticated;
grant execute on function public.gate_retention(uuid) to anon, authenticated;
grant execute on function public.gate_organic(uuid) to anon, authenticated;