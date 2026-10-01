export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Difficulty = "Easy" | "Medium" | "Hard";
export type SuggestionStatus = "pending" | "completed" | "dismissed";
export type ResourceCategory = "Template" | "Interview Log" | "Cheat Sheet" | "Article";
export type TriState = "solved" | "attempted" | "unsolved";

export interface Profile {
  id: string;
  username: string;
  leetcode_username: string | null;
  avatar_url: string | null;
  active_squad_id: string | null;
  contest_rating: number | null;
  global_rank: number | null;
  streak: number;
  total_easy: number;
  total_medium: number;
  total_hard: number;
  contest_attended: number;
  contest_global_rank: number | null;
  contest_top_percentage: number | null;
  last_synced_at: string | null;
  leetcode_session_encrypted: string | null;
  leetcode_session_synced_at: string | null;
  created_at: string;
}

export interface CustomList {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string | null;
  is_curated: boolean;
  created_by: string | null;
  created_at: string;
  problems_count?: number;
}

export interface ListProblem {
  id: string;
  list_id: string;
  title: string;
  title_slug: string;
  difficulty: Difficulty;
  category: string;
  order_index: number;
}

export interface UserProblemStatus {
  id: string;
  user_id: string;
  problem_slug: string;
  status: "solved" | "attempted";
  notes: string | null;
  solved_at: string;
}

export interface Suggestion {
  id: string;
  from_user: string;
  to_user: string;
  problem_slug: string;
  problem_title: string;
  difficulty: Difficulty;
  /** Legacy column, kept in sync with `message` by a DB trigger. */
  note: string | null;
  /** v2 free-text from sender to recipient (plan Step 10). */
  message: string | null;
  status: SuggestionStatus;
  sender_time_sec: number | null;
  beat_time: boolean;
  deadline_at: string | null;
  parent_id: string | null;
  spoiler: boolean;
  /** Set when the recipient takes the challenge on. */
  accepted_at: string | null;
  /** Last reminder nudge; throttled to once per 24h. */
  reminded_at: string | null;
  created_at: string;
  completed_at: string | null;
  from_profile?: Profile;
  to_profile?: Profile;
}

/** Chain state derived from status + deadline (plan Step 17). */
export type ChainState = "active" | "completed" | "broken" | "timed_out";

export interface SharedResource {
  id: string;
  title: string;
  category: ResourceCategory;
  content: string;
  external_url: string | null;
  author_id: string | null;
  visibility: ResourceVisibility;
  squad_id: string | null;
  fork_of: string | null;
  /** Maintained by trigger (Loop C, Bible §47). */
  fork_count: number;
  created_at: string;
  author_profile?: Profile;
}

export type NoteVisibility = "private" | "squad" | "public";
/** Vault is shared-only: no private vault rows (Bible §16). */
export type ResourceVisibility = "squad" | "public";
/** Onboarding intent signal (plan Step 3). Not a skill assessment. */
export type Objective = "internship" | "fulltime" | "consistency";

export interface NotebookNote {
  id: string;
  owner_id: string;
  folder: string | null;
  pattern_tags: string[];
  problem_slug: string | null;
  title: string;
  body_md: string;
  visibility: NoteVisibility;
  squad_id: string | null;
  fork_of: string | null;
  fork_from: string | null;
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface NoteShare {
  id: string;
  note_id: string;
  shared_with: string;
  can_edit: boolean;
  created_at: string;
}

/** List-view shape: body_md excluded for lightweight lists (Bible §65). */
export type NotebookNoteSummary = Omit<NotebookNote, "body_md">;

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface LeetCodeSubmission {
  title: string;
  titleSlug: string;
  timestamp: string;
}

export interface Problem {
  title_slug: string;
  title: string;
  difficulty: Difficulty;
  question_id: string;
  paid_only: boolean;
  topics: string[];
  updated_at: string;
}

export interface Squad {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  created_by: string | null;
  invite_code: string;
  shared_goal_text: string | null;
  season_name: string | null;
  created_at: string;
  member_count?: number;
}

export interface SquadMember {
  squad_id: string;
  user_id: string;
  role: "admin" | "member";
  /** Membership flag, independent of the row existing. */
  active: boolean;
  joined_at: string;
  last_active_at: string;
  profile?: Profile;
}

/** The I'm Stuck ladder (Step 18). Ordering matters: never answer above it. */
export type StuckLevel = "nudge" | "pattern" | "direction" | "full";
export type StuckVisibility = "squad" | "public" | "anon";
export type StuckStatus = "open" | "helped" | "resolved";

export interface StuckRequest {
  id: string;
  user_id: string;
  problem_slug: string;
  battle_id: string | null;
  level: StuckLevel;
  visibility: StuckVisibility;
  squad_id: string | null;
  status: StuckStatus;
  last_reminded_at: string | null;
  created_at: string;
  author?: Profile;
  replies?: StuckReply[];
}

export interface StuckReply {
  id: string;
  request_id: string;
  author_id: string;
  level: StuckLevel;
  body_md: string;
  accepted: boolean;
  created_at: string;
  author?: Profile;
}

/** Action-oriented notifications (plan Step 23, Bible §36/§37). */
export type NotificationKind =
  | "challenge"
  | "challenge_completed"
  | "goal"
  | "revenge"
  | "recap"
  | "contest";

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  deep_link: string | null;
  actor_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
  actor?: Profile;
}

export interface SquadSeason {
  id: string;
  squad_id: string;
  name: string;
  objective: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "upcoming" | "active" | "complete";
  created_by: string | null;
  created_at: string;
}

export interface SquadGoal {
  id: string;
  squad_id: string;
  title: string;
  target_count: number;
  pattern: string | null;
  deadline: string | null;
  status: "active" | "completed";
  created_by: string | null;
  created_at: string;
  /** Progress counts solves from this date on (Step 19). */
  starts_at?: string | null;
  archived?: boolean;
}

export type BattleOutcome = "in_progress" | "solved" | "failed" | "abandoned";

export interface Battle {
  id: string;
  user_id: string;
  problem_slug: string;
  squad_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: BattleOutcome;
  self_reported: boolean;
  evidence: "leetcode" | "none";
  scratchpad_md: string | null;
  confidence: number | null;
  created_at: string;
}

export type ProblemEventKind =
  | "attempted"
  | "solved"
  | "explained"
  | "revisited"
  | "challenge_completed"
  | "failed"
  | "stuck";

export interface ProblemEvent {
  id: string;
  user_id: string;
  problem_slug: string;
  kind: ProblemEventKind;
  battle_id: string | null;
  duration_sec: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ApproachVisibility = "private" | "squad" | "public";

export interface Primer {
  id: string;
  slug: string;
  pattern: string;
  title: string;
  recognize_when: string[];
  mental_model: string | null;
  template_md: string | null;
  complexity: string | null;
  mistakes: string[];
  starter_slugs: string[];
  author_id: string | null;
  visibility: "squad" | "public";
  squad_id: string | null;
  created_at: string;
}

export type ReviewReason = "failed" | "gap" | "weak_pattern" | "bookmark" | "low_confidence";

export interface ReviewItem {
  id: string;
  user_id: string;
  problem_slug: string;
  reason: ReviewReason;
  due_at: string;
  done_at: string | null;
  created_at: string;
}
export type FeedEventType =
  | "solved" | "streak" | "contest" | "suggested" | "completed"
  | "solve" | "teach" | "challenge" | "complete" | "improve"
  | "stuck" | "resource" | "squad_milestone";

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  problem_title: string | null;
  problem_slug: string | null;
  difficulty: Difficulty | string | null;
  squad_id: string | null;
  object_type: string | null;
  object_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile;
  /** Embedded `actor:user_id (...)` widens to an array under generated types. */
  actor_profile?: Profile;
}

export interface Approach {
  id: string;
  user_id: string;
  problem_slug: string;
  pattern: string | null;
  core_idea: string;
  complexity_time: string | null;
  complexity_space: string | null;
  key_detail: string | null;
  edge_cases: string | null;
  mistakes: string | null;
  code: string | null;
  related_slugs: string[];
  visibility: ApproachVisibility;
  squad_id: string | null;
  fork_of: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
  /** Embedded `author:user_id (...)` widens to an array under generated types. */
  author_profile?: Profile;
}
