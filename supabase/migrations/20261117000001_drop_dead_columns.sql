-- Database audit, final part: columns nothing uses, and the old global board.
--
-- Push only after the PRs before it are live: the deployed code must no longer
-- read any of these. Checked read-only on production on 2026-11-17, so no
-- data is lost:
--   ai_calls.input_tokens / output_tokens   0 rows set (never written)
--   recommendation_log.engine_version       constant default 1 on every row
--   squads.season_name / shared_goal_text   0 rows set (only a demo seed wrote them)
--   user_problem_status.notes               0 rows set (notes live in notebook_notes)
--   squad_members.active                    always true (nothing sets it false)

alter table public.ai_calls drop column if exists input_tokens, drop column if exists output_tokens;
alter table public.recommendation_log drop column if exists engine_version;
alter table public.squads drop column if exists season_name, drop column if exists shared_goal_text;
alter table public.user_problem_status drop column if exists notes;
alter table public.squad_members drop column if exists active;

-- Superseded by public.leaderboard, which both tabs read.
drop function if exists public.global_leaderboard(text, text, integer, integer);
