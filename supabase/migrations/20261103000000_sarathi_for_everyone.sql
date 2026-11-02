-- Sarathi (the practice guide) on for everyone.
--
-- 20261003000023 made ai_enabled a per-squad experiment, default off. The
-- guide is now a core feature: every squad, existing and new, has it on.
-- Solo practisers (no squad) are allowed by lib/ai/gate.ts.
--
-- Abuse control does not move: every call is logged in ai_calls, the squad
-- keeps its 30-per-hour budget (ai_calls_remaining), and gate.ts now also caps
-- each person at 20 per hour across squads, counted from ai_calls by user_id.
-- The index below keeps that per-user count an index range scan however
-- large ai_calls grows.

alter table public.squads alter column ai_enabled set default true;
update public.squads set ai_enabled = true where ai_enabled is distinct from true;

comment on column public.squads.ai_enabled is
  'Sarathi (AI practice guide) for this squad. On by default since 20261103000000; set by the platform, never by a member.';

create index if not exists ai_calls_user_created_idx
  on public.ai_calls (user_id, created_at desc);
