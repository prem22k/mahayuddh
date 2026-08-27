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

export interface Profile {
  id: string;
  username: string;
  leetcode_username: string;
  avatar_url: string | null;
  contest_rating: number;
  global_rank: number | null;
  streak: number;
  total_easy: number;
  total_medium: number;
  total_hard: number;
  last_synced_at: string | null;
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
  note: string | null;
  status: SuggestionStatus;
  created_at: string;
  completed_at: string | null;
  from_profile?: Profile;
  to_profile?: Profile;
}

export interface SharedResource {
  id: string;
  title: string;
  category: ResourceCategory;
  content: string;
  external_url: string | null;
  author_id: string;
  created_at: string;
  author_profile?: Profile;
}

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
