import { createClient } from "@/lib/supabase/client";
import { normalizeSlug } from "@/lib/slug";
import { Suggestion, Difficulty } from "@/types/database";
import { DataError } from "@/lib/data/errors";

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

  if (error) {
    throw new DataError("suggestions", "Couldn't load challenges. Check your connection and retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("suggestions", "Couldn't load challenges. Check your connection and retry.");
  }
  return data as Suggestion[];
}

export async function getPendingSuggestionCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw new DataError("suggestions", "Couldn't count challenges. Retry.", { cause: error });
  return count ?? 0;
}

/** Challenges addressed to the caller and still awaiting them (Home inbox). */
export async function getIncomingSuggestionCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("suggestions")
    .select("*", { count: "exact", head: true })
    .eq("to_user", userId)
    .eq("status", "pending");
  if (error) {
    throw new DataError("suggestions", "Couldn't count your challenges. Retry.", { cause: error });
  }
  return count ?? 0;
}

export async function getSuggestionById(id: string): Promise<Suggestion | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .select(`
      *,
      from_profile:from_user (id, username, leetcode_username, avatar_url),
      to_profile:to_user (id, username, leetcode_username, avatar_url)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new DataError("suggestions", "Couldn't load this challenge. Retry.", { cause: error });
  }
  if (!data) return null;
  return data as Suggestion;
}

/**
 * Walk parent links up → oldest-first chain for the Chain ritual (§10).
 *
 * One recursive query, not up to ten sequential ones. The old version fetched
 * the leaf, read its parent_id, fetched the parent, and so on — a textbook N+1
 * that got slower exactly when the feature got better, because longer chains are
 * the success case §10 measures.
 *
 * Profiles are joined in a second batched query rather than per row, for the same
 * reason: the chain is small, but the pattern should not be N+1 shaped.
 */
export async function getChallengeChain(leafId: string): Promise<Suggestion[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("suggestion_chain", { p_leaf_id: leafId });
  if (error) {
    throw new DataError("suggestions", "Couldn't load the challenge chain. Retry.", { cause: error });
  }
  const chain = (data ?? []) as Suggestion[];
  if (chain.length === 0) return [];

  // One batched profile lookup for the whole chain.
  const ids = Array.from(
    new Set(chain.flatMap((r) => [r.from_user, r.to_user]).filter(Boolean)),
  ) as string[];
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", ids);
    const byId = new Map(((profiles ?? []) as { id: string; username: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
    for (const row of chain) {
      const from = byId.get(row.from_user) ?? null;
      const to = byId.get(row.to_user) ?? null;
      // The embedded-profile shape the old per-row join produced. Kept so every
      // caller that read from_profile/to_profile keeps working unchanged.
      (row as unknown as { from_profile: unknown }).from_profile = from;
      (row as unknown as { to_profile: unknown }).to_profile = to;
    }
  }
  return chain;
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
  message?: string;
  senderTimeSec?: number | null;
  beatTime?: boolean;
  deadlineAt?: string | null;
  parentId?: string | null;
  spoiler?: boolean;
}): Promise<CreateSuggestionResult> {
  const supabase = createClient();
  const slug = normalizeSlug(params.problemSlug);
  const title = params.problemTitle.trim();
  const message = params.message?.trim() || null;
  // Mirror DB guards client-side so junk never round-trips: slug format,
  // title presence, message cap (suggestions_note_cap = 2000 bytes).
  if (!title || !slug || (message && message.length > 2000)) {
    return { ok: false, reason: "invalid" };
  }
  if (params.fromUser === params.toUser) {
    return { ok: false, reason: "invalid" };
  }
  if (params.senderTimeSec != null && (!Number.isFinite(params.senderTimeSec) || params.senderTimeSec < 0)) {
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
      // `message` is the v2 column; `note` is the legacy name kept for the
      // migration backfill and stays in sync via the trigger below.
      message,
      status: "pending",
      sender_time_sec: params.senderTimeSec ?? null,
      beat_time: params.beatTime ?? false,
      deadline_at: params.deadlineAt ?? null,
      parent_id: params.parentId ?? null,
      spoiler: params.spoiler ?? false,
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

/** Pending challenges for a slug involving the caller (problem page wiring). */
export async function getChallengesForSlug(problemSlug: string): Promise<Suggestion[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("suggestions")
    .select("*, from_profile:from_user (id, username, avatar_url), to_profile:to_user (id, username, avatar_url)")
    .eq("problem_slug", problemSlug.toLowerCase())
    .eq("status", "pending")
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as Suggestion[];
}

// Dismiss is recipient-or-sender; completed history stays.
// Never writes completed_at: the suggestions table has no dismissed_at column,
// and stamping a dismissal as a completion would corrupt season metrics and
// the timeline. Guarded to pending so a completed row cannot be re-dismissed.
export async function dismissSuggestion(suggestionId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .update({ status: "dismissed" })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    throw new DataError("suggestions", "Couldn't dismiss that challenge. Try again.", { cause: error });
  }
  return Array.isArray(data) ? data.length > 0 : !!data;
}

/**
 * Accept: persists that the recipient took the challenge on, so the sender can
 * see it is in progress and the battle can be attached to it (plan Step 10).
 */
export async function acceptSuggestion(
  suggestionId: string,
  callerUserId: string
): Promise<{ ok: boolean; reason?: "not_recipient" | "not_pending" }> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from("suggestions")
    .select("id, to_user, status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!row || row.to_user !== callerUserId) return { ok: false, reason: "not_recipient" };
  if (row.status !== "pending") return { ok: false, reason: "not_pending" };

  // Guarded write: a concurrent accept/complete/dismiss wins the race and this
  // becomes a no-op instead of resurrecting a dead row.
  const { data: updated, error } = await supabase
    .from("suggestions")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    throw new DataError("suggestions", "Couldn't accept that challenge. Try again.", { cause: error });
  }
  if (!updated || (Array.isArray(updated) && updated.length === 0)) {
    return { ok: false, reason: "not_pending" };
  }
  return { ok: true };
}

/**
 * Remind the other party at most once per 24h (plan Step 10). Low-noise: this
 * is the only "nudge" primitive, and the throttle is enforced server-side.
 */
export async function remindSuggestion(
  suggestionId: string,
  callerUserId: string
): Promise<{ ok: boolean; reason?: "not_party" | "throttled" | "not_pending" }> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from("suggestions")
    .select("id, from_user, to_user, status, reminded_at")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_party" };
  if (row.from_user !== callerUserId && row.to_user !== callerUserId) {
    return { ok: false, reason: "not_party" };
  }
  if (row.status !== "pending") return { ok: false, reason: "not_pending" };
  if (row.reminded_at && Date.now() - new Date(row.reminded_at).getTime() < 86_400_000) {
    return { ok: false, reason: "throttled" };
  }

  // Race-safe throttle: the 24h window is enforced in the WHERE clause
  // (reminded_at IS NULL OR reminded_at < now()-24h), and the affected row
  // count decides. Two tabs nudging together send one reminder, not two.
  const cutoffISO = new Date(Date.now() - 86_400_000).toISOString();
  const { data: updated, error } = await supabase
    .from("suggestions")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .or(`reminded_at.is.null,reminded_at.lt.${cutoffISO}`)
    .select("id");
  if (error) {
    throw new DataError("suggestions", "Couldn't send that reminder. Try again.", { cause: error });
  }
  if (!updated || (Array.isArray(updated) && updated.length === 0)) {
    return { ok: false, reason: "throttled" };
  }

  // Tell the other party, if they are a real user with notifications on.
  const recipient = row.from_user === callerUserId ? row.to_user : row.from_user;
  try {
    const { notify } = await import("@/lib/data/notifications");
    await notify({
      userId: recipient,
      kind: "challenge",
      title: "Challenge reminder",
      body: `Someone nudged you about a pending challenge.`,
      deepLink: `/c/${suggestionId}`,
      actorId: callerUserId,
    });
  } catch {
    // Notification is best-effort; the reminder is already recorded.
  }
  return { ok: true };
}

// caller's own status map (dock/sheet self-report counts; LeetCode sync merely
// adds an evidence badge). Never completes on a bare button press.
// Manual completion is assignee-only and requires the problem solved in the
// caller's own status map. Never completes on a bare button press.
export async function markSuggestionCompleted(
  suggestionId: string,
  callerUserId: string
): Promise<{ ok: boolean; reason?: "not_assignee" | "not_solved" }> {
  const supabase = createClient();
  const { data: suggestion } = await supabase
    .from("suggestions")
    .select("id, from_user, to_user, problem_slug, problem_title, status")
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

  // Guarded to pending: a concurrent complete/dismiss wins instead of a double write.
  const { data: updated, error } = await supabase
    .from("suggestions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, reason: "not_assignee" };
  if (!updated || (Array.isArray(updated) && updated.length === 0)) {
    // Lost the race (or already completed above): re-read to report honestly.
    const { data: reread } = await supabase
      .from("suggestions")
      .select("status")
      .eq("id", suggestionId)
      .maybeSingle();
    if ((reread as { status?: string } | null)?.status === "completed") return { ok: true };
    return { ok: false, reason: "not_assignee" };
  }
  const { logProblemEvent } = await import("@/lib/data/problemEvents");
  await logProblemEvent({ problemSlug: suggestion.problem_slug, kind: "challenge_completed" }).catch(() => {});

  // The sender is owed an answer: this is the return reason for the ritual (§10).
  try {
    const { notify } = await import("@/lib/data/notifications");
    await notify({
      userId: suggestion.from_user,
      kind: "challenge_completed",
      title: "Challenge completed",
      body: `@${callerUserId.slice(0, 8)} solved ${suggestion.problem_title}.`,
      deepLink: `/c/${suggestionId}`,
      actorId: callerUserId,
    });
  } catch {
    // Best-effort: never block the completion itself.
  }

  return { ok: true };
}