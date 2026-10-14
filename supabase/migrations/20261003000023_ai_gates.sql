-- Step 25 — AI gates (Bible §45).
--
-- §45's objective is one sentence: "Use AI to increase thinking, not eliminate
-- thinking." The bad-use list is about as explicit as a product spec gets:
-- instant full solutions as the primary action, AI filler posts, replacing
-- community explanations, auto-writing hundreds of generic primers.
--
-- So this migration builds the FENCES before anything that needs a model. Every
-- one of these is a constraint the app cannot opt out of at request time:
--
--   - ai_enabled is per squad and defaults OFF. §45's features are an
--     experiment, and an experiment that is on by default is not an experiment.
--   - A hard ladder ceiling: an assistant may never answer above the level the
--     asker requested. Enforced in SQL as well as in the client, because the
--     client is the wrong place for the one rule that keeps the product honest.
--   - Rate limits per squad per hour, so one squad cannot spend the budget.
--   - Every AI call is logged, including refusals. A guardrail nobody can audit
--     is a guardrail that quietly stopped working.
--
-- No provider is configured in this repository, so nothing here calls a model.
-- See lib/ai/policy.ts for the seam.

alter table public.squads add column if not exists ai_enabled boolean not null default false;

comment on column public.squads.ai_enabled is
  '§45: AI features are a per-squad experiment, off by default. Set by the platform, never by a member.';

-- ── AI call log ─────────────────────────────────────────────────────────────
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  -- The §45 feature names, verbatim. 'practice_next' is the deterministic one
  -- and needs no model, which is why it is in the same vocabulary.
  feature text not null check (feature in (
    'stuck_assistant', 'explain_mistake', 'practice_next', 'explain_back', 'interview_sim'
  )),
  -- The ladder level the asker requested. NULL for features with no ladder.
  requested_level text check (requested_level is null or requested_level in ('nudge', 'pattern', 'direction', 'full')),
  -- The level the assistant actually answered at. MUST NOT exceed
  -- requested_level; enforced by the trigger below rather than by convention.
  answered_level text check (answered_level is null or answered_level in ('nudge', 'pattern', 'direction', 'full')),
  -- 'ok' | 'refused' (broke the ladder) | 'rate_limited' | 'disabled' | 'no_provider' | 'error'
  outcome text not null default 'ok'
    check (outcome in ('ok', 'refused', 'rate_limited', 'disabled', 'no_provider', 'error')),
  refusal_reason text,
  input_chars int,
  output_chars int,
  -- Token counts when a provider reported them. Null otherwise — never invented,
  -- because a cost cap enforced on guessed numbers is not a cost cap.
  input_tokens int,
  output_tokens int,
  latency_ms int,
  engine text,
  created_at timestamp with time zone default now()
);
create index if not exists ai_calls_squad_idx on public.ai_calls (squad_id, created_at desc);
create index if not exists ai_calls_feature_idx on public.ai_calls (feature, created_at desc);

alter table public.ai_calls enable row level security;

-- Members may read their own calls, so they can see what was refused and why.
drop policy if exists "Users read own AI calls" on public.ai_calls;
create policy "Users read own AI calls" on public.ai_calls for select
  using ((select auth.uid()) = user_id);

-- No client INSERT policy at all: AI calls are logged server-side so a bug in a
-- client cannot fabricate usage, and so the ladder check cannot be bypassed by
-- simply not writing the row.

-- ── The ladder ceiling, enforced in the database ────────────────────────────
-- The single most important line in this feature. §12 and §45 both insist the
-- assistant must not hand over a solution; the requested level is the contract
-- and the helper may not answer above it. If that is only enforced in the
-- client, one API call from anywhere breaks the promise the whole stuck ladder
-- is built on.
create or replace function public.enforce_ai_ladder_ceiling()
returns trigger language plpgsql as $$
declare
  rank int;
  asked int;
  answered int;
begin
  if new.requested_level is null or new.answered_level is null then
    return new;
  end if;

  rank :=
    case new.answered_level
      when 'nudge' then 1 when 'pattern' then 2
      when 'direction' then 3 when 'full' then 4
    end;
  asked :=
    case new.requested_level
      when 'nudge' then 1 when 'pattern' then 2
      when 'direction' then 3 when 'full' then 4
    end;

  if rank > asked then
    -- Refuse rather than raise. The caller sees 'refused' and can show the
    -- user that the ladder held, which is a better outcome than a 500.
    new.outcome := 'refused';
    new.refusal_reason := 'answered above the requested ladder level';
    new.answered_level := new.requested_level;
  end if;

  return new;
end $$;

drop trigger if exists enforce_ai_ladder_ceiling on public.ai_calls;
create trigger enforce_ai_ladder_ceiling
  before insert on public.ai_calls
  for each row execute function public.enforce_ai_ladder_ceiling();

-- ── Budget: per squad, per hour ─────────────────────────────────────────────
-- §45 lists "cost caps" as a guardrail. A cap measured in rows per hour is a
-- proxy, but it is one the database can enforce without knowing about tokens or
-- prices, and an approximate cap that holds beats an exact cap that is only
-- checked in application code.
create or replace function public.ai_calls_remaining(p_squad uuid)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 30 - count(*)::int)
  from public.ai_calls
  where squad_id = p_squad
    and created_at > now() - interval '1 hour'
    and outcome not in ('refused', 'disabled')
$$;

comment on function public.ai_calls_remaining(uuid) is
  '§45 cost cap proxy: AI calls allowed for this squad in the last hour. Refused and disabled calls do not consume budget — a squad should not be charged for the guardrail stopping the model.';

grant execute on function public.ai_calls_remaining(uuid) to anon, authenticated;
