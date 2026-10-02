import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { LEVEL_RANK } from "@/lib/stuckLadder";
import type {
  StuckRequest,
  StuckReply,
  StuckLevel,
  StuckVisibility,
} from "@/types/database";

const REQUEST_COLUMNS = `
  *,
  author:user_id (id, username, avatar_url),
  replies:stuck_replies (
    id, request_id, author_id, level, body_md, accepted, created_at,
    author:author_id (id, username, avatar_url)
  )
`;

/**
 * Open requests the caller can answer. RLS decides visibility; `anon` requests
 * come back without the author, so callers must not assume one is present.
 */
export async function getOpenStuckRequests(limit = 30): Promise<StuckRequest[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("stuck_requests")
    .select(REQUEST_COLUMNS)
    .eq("status", "open")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataError("stuck", "Couldn't load stuck requests. Retry.", { cause: error });
  }
  if (!data) throw new DataError("stuck", "Couldn't load stuck requests. Retry.");

  // Embedded relations widen to arrays under the generated PostgREST types.
  return (data as unknown as StuckRequest[]).map(normalizeReplies);
}

/** The caller's own requests, newest first — with replies. */
export async function getMyStuckRequests(limit = 20): Promise<StuckRequest[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("stuck_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataError("stuck", "Couldn't load your stuck requests. Retry.", { cause: error });
  }
  if (!data) throw new DataError("stuck", "Couldn't load your stuck requests. Retry.");
  return (data as unknown as StuckRequest[]).map(normalizeReplies);
}

function normalizeReplies(r: StuckRequest): StuckRequest {
  const raw = (r as { replies?: unknown }).replies;
  return {
    ...r,
    replies: Array.isArray(raw)
      ? (raw as unknown as StuckReply[])
      : raw
        ? [raw as unknown as StuckReply]
        : [],
  };
}

/**
 * Ask for help. Server enforces both the 3-open-requests cap and that the
 * level is real, so this only has to produce honest arguments.
 */
export async function createStuckRequest(params: {
  problemSlug: string;
  level: StuckLevel;
  visibility?: StuckVisibility;
  battleId?: string | null;
  squadId?: string | null;
}): Promise<{ ok: true; request: StuckRequest } | { ok: false; error: string }> {
  const supabase = createClient();
  const visibility = params.visibility ?? "squad";

  // user_id has to be sent explicitly. The insert policy is
  // `with check ((select auth.uid()) = user_id)` and no trigger fills it in, so
  // omitting it fails with a not-null violation for every caller.
  //
  // This was broken from Step 18 until a browser test drove the Ask-help tile
  // and surfaced "Couldn't post that request. The integration suite missed it
  // because it inserted through the service role, which bypasses RLS and was
  // given a user_id by the test itself.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to ask for help." };

  const { data, error } = await supabase
    .from("stuck_requests")
    .insert({
      user_id: user.id,
      problem_slug: params.problemSlug.toLowerCase(),
      level: params.level,
      visibility,
      battle_id: params.battleId ?? null,
      squad_id: visibility === "squad" ? (params.squadId ?? null) : null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    // The cap is a trigger, so it arrives as a raised exception.
    if (error.message.includes("3 open stuck requests")) {
      return { ok: false, error: "You already have 3 open requests. Close or resolve one first." };
    }
    return { ok: false, error: "Couldn't post that request. Try again." };
  }
  if (!data) return { ok: false, error: "Couldn't post that request. Try again." };

  const request = data as StuckRequest;
  track("stuck_requested", { level: params.level, visibility });

  // Squad activity (§50). `anon` visibility does not mean anonymous author:
  // the feed row is the author's own, and readers never see the body.
  if (visibility !== "anon") {
    const { logFeedEvent } = await import("@/lib/data/feed");
    const { getActiveSquadId } = await import("@/lib/data/squads");
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const squadId = params.squadId ?? (userId ? await getActiveSquadId(userId) : null);
    if (squadId) {
      logFeedEvent({
        eventType: "stuck",
        squadId,
        problemSlug: params.problemSlug,
        objectType: "stuck_request",
        objectId: request.id,
        metadata: { level: params.level },
      }).catch(() => {});
    }
  }

  return { ok: true, request };
}

/**
 * Answer at a level. The database refuses anything above what was asked for —
 * that is the ladder's guarantee, so the client does not have to police it.
 */
export async function replyToStuckRequest(params: {
  requestId: string;
  level: StuckLevel;
  bodyMd: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = params.bodyMd.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > 4000) return { ok: false, error: "Keep it under 4000 characters." };

  const supabase = createClient();
  // author_id has to be sent: the insert policy is
  // `with check ((select auth.uid()) = author_id)` with no trigger filling it.
  // Same class of bug as createStuckRequest above, and it meant the whole
  // respond-to-a-stuck-mate path failed for everyone.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to reply." };

  const { error } = await supabase.from("stuck_replies").insert({
    request_id: params.requestId,
    author_id: user.id,
    level: params.level,
    body_md: body,
  });

  if (error) {
    if (error.message.includes("more help than the asker requested")) {
      return {
        ok: false,
        error: "That gives more help than they asked for. Answer at their level or lower.",
      };
    }
    return { ok: false, error: "Couldn't post that reply. Try again." };
  }

  track("stuck_resolved", { via: "replied", level: params.level });
  return { ok: true };
}

/** Accept a reply and close the loop. */
export async function acceptStuckReply(requestId: string, replyId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stuck_replies")
    .update({ accepted: true })
    .eq("id", replyId)
    .eq("request_id", requestId);
  if (error) return false;
  await setStuckRequestStatus(requestId, "resolved");
  return true;
}

export async function setStuckRequestStatus(
  requestId: string,
  status: StuckRequest["status"]
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stuck_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) {
    throw new DataError("stuck", "Couldn't update that request. Try again.", { cause: error });
  }
}

export async function deleteStuckRequest(requestId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stuck_requests").delete().eq("id", requestId);
  if (error) {
    throw new DataError("stuck", "Couldn't delete that request. Try again.", { cause: error });
  }
}

/** One nudge per 24h. The server stamps `last_reminded_at`. */
export async function remindStuckRequest(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stuck_requests")
    .update({ last_reminded_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Couldn't send that nudge. Try again." };
  const row = data as StuckRequest | null;
  if (!row) return { ok: false, error: "Couldn't send that nudge. Try again." };
  // The RLS update policy only allows the author, so a successful update means
  // the caller owns the request. A helper nudging is not permitted by design:
  // low noise beats responsiveness here (§37).
  return { ok: true };
}

/** Level a helper picked is capped by what the asker wanted. Exposed for the UI. */
export function maxAllowedLevel(asked: StuckLevel): StuckLevel {
  return asked;
}

export { LEVEL_RANK };