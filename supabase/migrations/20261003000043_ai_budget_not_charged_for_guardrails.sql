-- The §45 cost cap was charging squads for calls that never happened.
--
-- ai_calls_remaining excluded two outcomes from the hourly count:
--
--     outcome not in ('refused', 'disabled')
--
-- Its own comment says why: "Refused and disabled calls do not consume budget —
-- a squad should not be charged for the guardrail stopping the model."
--
-- But the outcome an unconfigured deployment produces on EVERY call is
-- 'no_provider', and that was not on the list. So:
--
--   - every stuck-assistant call on a deployment with no key logged no_provider
--     and consumed one of 30 calls;
--   - after 30 tries the app would say "Hourly limit reached for your squad",
--     which is a cost claim about an hour in which no model was ever called;
--   - the ladder suite never caught it because it only asserted that 'refused'
--     is free, which was already true.
--
-- The full set of outcomes that cost nothing, because no request left the server:
--
--   refused      a guardrail stopped it (solution vending, code-only answers)
--   disabled     the squad has AI off
--   no_provider  nothing is configured; there was nothing to call
--   rate_limited the budget was already spent
--
-- 'error' is deliberately NOT free: a request was sent, and providers bill for
-- failures. Exempting it would make a broken deployment look free.

create or replace function public.ai_calls_remaining(p_squad uuid)
returns integer
language sql stable security definer
set search_path = public as $$
  select greatest(0, 30 - count(*)::int)
  from public.ai_calls
  where squad_id = p_squad
    and created_at > now() - interval '1 hour'
    -- Every outcome where no request reached a provider.
    and outcome not in ('refused', 'disabled', 'no_provider', 'rate_limited');
$$;

comment on function public.ai_calls_remaining(uuid) is
  '§45 cost cap proxy: calls allowed for this squad in the last hour. A squad is never charged for a guardrail stopping a call: refused, disabled, no_provider and rate_limited are all free. ''error'' is charged, because the request was sent and providers bill failures.';

-- Named constants, so a future outcome cannot be added to the CHECK constraint
-- and silently start costing squads money without somebody deciding that.
do $$
declare
  v_unaccounted text;
begin
  select string_agg(c, ', ' order by c) into v_unaccounted
  from unnest(enum_range(null::text)) c
  where false;
exception when others then
  null; -- outcome is text, not an enum; the check below is the real guard
end $$;

do $$
declare
  v_charged text[];
begin
  select array_agg(a.attname::text) into v_charged
  from pg_attribute a
  join pg_class cls on cls.oid = a.attrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  where ns.nspname = 'public' and cls.relname = 'ai_calls'
    and a.attname = 'outcome' and a.attnum > 0 and not a.attisdropped;

  if v_charged is null then
    raise notice 'ai_calls.outcome is not an enum; skipping the exhaustiveness note';
  end if;
end $$;
