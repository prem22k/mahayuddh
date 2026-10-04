-- A real guard for the cost-cap outcome list (see 00043).
--
-- 00043 fixed the list but ended with two blocks that could not work: it tried to
-- enumerate outcomes from pg_attribute as though ai_calls.outcome were an enum,
-- and it is a text column with a CHECK constraint. So both blocks silently did
-- nothing, which is the worst outcome for a block whose whole purpose is to
-- notice something.
--
-- The failure being guarded against is real and is how 00043 happened: somebody
-- added an outcome to the CHECK constraint, and nobody decided whether it costs
-- a squad money. `no_provider` was in the CHECK from the start and missing from
-- the budget list the whole time.
--
-- So read the CHECK constraint's own definition, pull the allowed values out of
-- it, and require every one of them to be classified in ai_calls_remaining —
-- either free (no request left the server) or charged (a provider was called).
-- An unclassified outcome is a migration-time error rather than a surprise in a
-- cost report.

do $$
declare
  v_check text;
  v_allowed text[];
  v_classified text[] := array[
    'refused', 'disabled', 'no_provider', 'rate_limited',   -- free
    'ok', 'error'                                              -- charged
  ];
  v_missing text[];
begin
  select pg_get_constraintdef(oid) into v_check
  from pg_constraint
  where conrelid = 'public.ai_calls'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%outcome%';

  if v_check is null then
    raise notice 'no CHECK constraint on ai_calls.outcome found; nothing to verify';
    return;
  end if;

  -- The definition reads CHECK ((outcome = ANY (ARRAY['ok'::text, 'refused'::text, ...]))).
  -- Pull the quoted values out of it rather than maintaining a second copy of the
  -- list here, which is how the two would drift again.
  select array_agg(distinct m[1])
    into v_allowed
  from regexp_matches(v_check, '''([a-z_]+)''', 'g') as m;

  select array_agg(a order by a)
    into v_missing
  from unnest(v_allowed) a
  where a <> all (v_classified);

  if v_missing is not null then
    raise exception
      'ai_calls.outcome allows % which ai_calls_remaining does not classify. Add it to the free list or the charged list in 00043 — an unclassified outcome silently decides a cost policy by accident.',
      array_to_string(v_missing, ', ');
  end if;

  raise notice 'ai_calls.outcome classification verified: % values, all classified',
    coalesce(array_length(v_allowed, 1), 0);
end $$;

-- Confirm the current function really is the fixed one, rather than trusting that
-- the migration above ran in the order it appears to.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(oid) into v_def
  from pg_proc
  where proname = 'ai_calls_remaining'
    and pronamespace = 'public'::regnamespace;

  if v_def is null then
    raise exception 'ai_calls_remaining is missing';
  end if;
  if v_def !~ 'no_provider' then
    raise exception 'ai_calls_remaining does not exempt no_provider — 00043 appears to have been undone';
  end if;
end $$;
