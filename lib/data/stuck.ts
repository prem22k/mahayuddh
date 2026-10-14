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

/** Accept a reply and close the loop. Guarded: only an open request resolves. */
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
  // Guard closing transitions to open rows only, so two tabs resolving together
  // cannot flip a dismissed/re-resolved row and the affected count is honest.
  // Reopening (resolved -> open) is the only transition allowed off open.
  let query = supabase.from("stuck_requests").update({ status }).eq("id", requestId);
  if (status === "resolved" || status === "helped") {
    query = query.eq("status", "open");
  }
  const { error } = await query;
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

/** One nudge per 24h, open requests only. The server stamps `last_reminded_at`. */
export async function remindStuckRequest(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  // Race-safe throttle enforced in WHERE (last_reminded_at IS NULL OR older
  // than 24h) plus open-status guard; the affected row count decides.
  const cutoffISO = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("stuck_requests")
    .update({ last_reminded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open")
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${cutoffISO}`)
    .select("id");

  if (error) return { ok: false, error: "Couldn't send that nudge. Try again." };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return { ok: false, error: "Already nudged in the last 24 hours, or the request is closed." };
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
/**
 * Open "I'm stuck" asks on the problems of one pattern, for the pattern hub
 * (Step 15 / §17).
 *
 * The hub's seventh section, and the one that joins two loops: §17 makes the
 * pattern page a hub rather than a page, and this is what connects it to the
 * stuck ladder. A member who opens "Sliding Window" and sees two squad-mates
 * stuck inside it learns something a primer cannot say — that this pattern is
 * where their squad is actually losing time, which is a different and more useful
 * reason to read it.
 *
 * Deliberately public-read rather than caller-filtered. A stuck request is
 * already a request for help, and the ladder's whole design is that help is
 * offered at the level the asker chose. Hiding the existence of an ask on the
 * hub would recreate the private-first problem in the one place where seeing it
 * is the entire value.
 *
 * Author names are joined but never the request body: the hub shows WHO is stuck
 * on WHAT and at WHAT level, which is what makes it useful, and not what they
 * wrote, which is theirs to share or not.
 */
export async function getStuckRequestsForPattern(
  problemSlugs: string[],
  limit = 6,
): Promise<StuckRequest[]> {
  const supabase = createClient();
  const unique = Array.from(new Set(problemSlugs.map((s) => s.trim().toLowerCase()))).filter(Boolean);
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from("stuck_requests")
    .select(
      "id, user_id, problem_slug, battle_id, level, visibility, squad_id, status, last_reminded_at, created_at, " +
        "author:user_id (id, username, leetcode_username, avatar_url)",
    )
    .eq("status", "open")
    .in("problem_slug", unique)
    // Not `.neq("user_id", …)`: this is a public hub and the reader is not
    // necessarily signed in, so there is no caller to exclude.
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataError("stuck", "Couldn't load asks for this pattern. Retry.", { cause: error });
  }

  return (data as unknown as StuckRequest[]).map(normalizeReplies);
}
