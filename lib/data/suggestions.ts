import { createClient } from "@/lib/supabase/client";
import { Suggestion, Difficulty } from "@/types/database";

export async function getSuggestions(): Promise<Suggestion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .select(`
      *,
      from_profile:from_user (id, username, leetcode_username, avatar_url),
      to_profile:to_user (id, username, leetcode_username, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Suggestion[];
}

export async function getPendingSuggestionCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) return 0;
  return count ?? 0;
}

export async function createSuggestion(params: {
  fromUser: string;
  toUser: string;
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  note?: string;
}): Promise<Suggestion | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .insert({
      from_user: params.fromUser,
      to_user: params.toUser,
      problem_slug: params.problemSlug,
      problem_title: params.problemTitle,
      difficulty: params.difficulty,
      note: params.note || null,
      status: "pending",
    })
    .select(`
      *,
      from_profile:from_user (id, username, leetcode_username, avatar_url),
      to_profile:to_user (id, username, leetcode_username, avatar_url)
    `)
    .maybeSingle();

  if (error || !data) return null;
  return data as Suggestion;
}

export async function markSuggestionCompleted(suggestionId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("suggestions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  return !error;
}
