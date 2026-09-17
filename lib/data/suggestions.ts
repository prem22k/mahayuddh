import { createClient } from "@/lib/supabase/client";
import { normalizeSlug } from "@/lib/slug";
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

export type CreateSuggestionResult =
  | { ok: true; suggestion: Suggestion }
  | { ok: false; reason: "duplicate" | "invalid" | "error" };

export async function createSuggestion(params: {
  fromUser: string;
  toUser: string;
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  note?: string;
}): Promise<CreateSuggestionResult> {
  const supabase = createClient();
  const slug = normalizeSlug(params.problemSlug);
  const title = params.problemTitle.trim();
  const note = params.note?.trim() || null;
  // Mirror DB guards client-side so junk never round-trips: slug format,
  // title presence, note cap (suggestions_note_cap = 2000 bytes).
  if (!title || !slug || (note && note.length > 2000)) {
    return { ok: false, reason: "invalid" };
  }
  if (params.fromUser === params.toUser) {
    return { ok: false, reason: "invalid" };
  }
  const { data, error } = await supabase
    .from("suggestions")
    .insert({
      from_user: params.fromUser,
      to_user: params.toUser,
      problem_slug: slug,
      problem_title: title,
      difficulty: params.difficulty,
      note,
      status: "pending",
    })
    .select(`
      *,
      from_profile:from_user (id, username, leetcode_username, avatar_url),
      to_profile:to_user (id, username, leetcode_username, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    // Partial unique index suggestions_pending_unique → friendly duplicate UX.
    if (error.code === "23505") return { ok: false, reason: "duplicate" };
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "error" };
  return { ok: true, suggestion: data as Suggestion };
}

// Manual completion is assignee-only and requires LeetCode proof: the problem
// must be solved in the caller's own status map (written only via the verified
// RPC/session paths), never on a bare button press.
export async function markSuggestionCompleted(
  suggestionId: string,
  callerUserId: string
): Promise<{ ok: boolean; reason?: "not_assignee" | "not_solved" }> {
  const supabase = createClient();
  const { data: suggestion } = await supabase
    .from("suggestions")
    .select("id, to_user, problem_slug, status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion || suggestion.to_user !== callerUserId) {
    return { ok: false, reason: "not_assignee" };
  }
  if (suggestion.status === "completed") return { ok: true };

  const { data: solved } = await supabase
    .from("user_problem_status")
    .select("problem_slug")
    .eq("user_id", callerUserId)
    .eq("problem_slug", suggestion.problem_slug)
    .eq("status", "solved")
    .maybeSingle();

  if (!solved) return { ok: false, reason: "not_solved" };

  const { error } = await supabase
    .from("suggestions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  return error ? { ok: false, reason: "not_assignee" } : { ok: true };
}
