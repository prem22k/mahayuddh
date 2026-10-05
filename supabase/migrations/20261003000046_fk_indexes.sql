-- Backend optimization, part 1: index every foreign key (follow-up to the perf audit).
--
-- Postgres does not index foreign keys automatically, and 29 of this schema's 70
-- FK columns had no index at all. That matters in exactly the places this app is
-- slowest, because RLS policies join on precisely these columns:
--
--   note_shares.note_id / shared_with   the EXISTS pair inside the notebook_notes
--                                       sharing policies (fixed for recursion in
--                                       00035, never indexed)
--   squad_members.* / squads.*          every squad-scoped read and every §58 gate
--   problem_events.user_id              the retention gate, recommendations, recap
--   suggestions.from_user / to_user     the challenge loop's core lookups
--   profiles.active_squad_id            gate_organic, the squad switcher
--
-- The research behind this (Supabase RLS performance docs; measured matrices)
-- puts "index the columns your policies filter on" first for a reason: on the
-- standard 100k-row fixture, an indexed policy column takes a per-row auth check
-- from ~170ms to under a millisecond, and it is the precondition that makes the
-- other rewrites matter. An index is also the only one of these fixes that helps
-- the bare and the wrapped form alike.
--
-- All 29 are plain btrees on a single column. No partial, no expression, no
-- covering indexes: at this schema's size the planner wants the obvious thing,
-- and an exotic index nobody asked for is a maintenance cost disguised as an
-- optimization.

create index if not exists ai_calls_user_id_idx on public.ai_calls (user_id);
create index if not exists approaches_fork_of_idx on public.approaches (fork_of);
create index if not exists approaches_squad_id_idx on public.approaches (squad_id);
create index if not exists battles_squad_id_idx on public.battles (squad_id);
create index if not exists daily_battles_user_id_idx on public.daily_battles (user_id);
create index if not exists discussion_replies_author_id_idx on public.discussion_replies (author_id);
create index if not exists discussions_squad_id_idx on public.discussions (squad_id);
create index if not exists feature_triage_decided_by_idx on public.feature_triage (decided_by);
create index if not exists follows_follower_id_idx on public.follows (follower_id);
create index if not exists note_shares_note_id_idx on public.note_shares (note_id);
create index if not exists note_shares_shared_with_idx on public.note_shares (shared_with);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists platform_posts_author_id_idx on public.platform_posts (author_id);
create index if not exists primers_author_id_idx on public.primers (author_id);
create index if not exists primers_squad_id_idx on public.primers (squad_id);
create index if not exists profiles_active_squad_id_idx on public.profiles (active_squad_id);
create index if not exists profiles_invited_by_idx on public.profiles (invited_by);
create index if not exists profiles_joined_via_referral_idx on public.profiles (joined_via_referral);
create index if not exists shared_resources_squad_id_idx on public.shared_resources (squad_id);
create index if not exists squad_goals_created_by_idx on public.squad_goals (created_by);
create index if not exists squad_recaps_generated_by_idx on public.squad_recaps (generated_by);
create index if not exists squad_seasons_created_by_idx on public.squad_seasons (created_by);
create index if not exists squads_created_by_idx on public.squads (created_by);
create index if not exists stuck_replies_author_id_idx on public.stuck_replies (author_id);
create index if not exists stuck_requests_battle_id_idx on public.stuck_requests (battle_id);
create index if not exists stuck_requests_squad_id_idx on public.stuck_requests (squad_id);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks (blocked_id);
create index if not exists user_blocks_blocker_id_idx on public.user_blocks (blocker_id);
create index if not exists validation_observations_observed_by_idx on public.validation_observations (observed_by);
