import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent, redactForLog } from "@/lib/security/log";
import { inQuietHoursIST } from "@/lib/quietHours";

export const dynamic = "force-dynamic";

const KINDS = ["challenge", "challenge_completed", "goal", "revenge", "recap", "contest", "nudge"] as const;

// POST /api/notify {userId, kind, title, body?, deepLink?, actorId?, urgent?}
// The notifications table has no client INSERT policy, so writes are service-role
// only and this route is the single writer. Notifications always target somebody
// other than the caller (no "you notified yourself" loops).
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = await requireUser(request, "/api/notify");
  if (auth.response) return auth.response;
  const caller = auth.user;

  /**
   * This route turns any authenticated caller into a push-delivery service for
   * an arbitrary user id, with arbitrary text, up to the push provider's
   * throughput. Without a cap it is a spam cannon aimed at a stranger's phone,
   * and push is not something a user can rate-limit their way out of. Thirty an
   * hour is far above any real product flow.
   */
  const limit = rateLimit({
    ...RATE_RULES.notify,
    key: rateLimitKey("notify", { userId: caller.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", { route: "/api/notify", actor_id: caller.id });
    return NextResponse.json(
      { error: "You've sent a lot of notifications. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 500) : null;
  const urgent = body.urgent === true;

  if (!userId || !KINDS.includes(kind as (typeof KINDS)[number]) || !title) {
    return NextResponse.json({ error: "userId, a known kind, and a title are required." }, { status: 400 });
  }
  if (userId === caller.id) {
    return NextResponse.json({ error: "Can't notify yourself." }, { status: 400 });
  }

  /**
   * `actorId` is not trusted. It is the name rendered next to the notification
   * and it is what a recipient would click to see who acted, so accepting a
   * caller-supplied value lets anyone send a "challenge from <victim>" to
   * anybody. The actor is always the authenticated caller.
   */
  if (typeof body.actorId === "string" && body.actorId !== caller.id) {
    logSecurityEvent("input.rejected", {
      route: "/api/notify",
      actor_id: caller.id,
      detail: "attempted to forge a notification actor",
    });
  }

  // Quiet hours: batchable nudges (goal / recap / contest / nudge) are
  // suppressed, direct challenge pings are not — someone is waiting on a reply. Hours are IST
  // (Asia/Kolkata) via the shared helper. NOTE: the DB in_quiet_hours()
  // function still uses UTC until a migration lands; trigger-based nudges
  // (goal/contest) follow that path and are out of scope for this wave.
  const BATCHABLE = new Set(["goal", "recap", "contest", "nudge"]);
  if (!urgent && BATCHABLE.has(kind) && inQuietHoursIST(new Date())) {
    return NextResponse.json({ skipped: "quiet_hours" });
  }

  const deepLink =
    typeof body.deepLink === "string" && /^\/[A-Za-z0-9/_?=&%-]*$/.test(body.deepLink)
      ? body.deepLink
      : null;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    kind,
    title,
    body: text,
    deep_link: deepLink,
    actor_id: caller.id,
  });

  if (error) {
    return NextResponse.json({ error: "Couldn't create notification" }, { status: 500 });
  }

  // Push is a nice-to-have: a push failure must not undo the in-app record.
  try {
    const { sendPushToUser } = await import("@/lib/push");
    const push = await sendPushToUser(userId, { title, body: text ?? undefined, url: deepLink ?? "/" });
    if (push.sent === 0) {
      console.warn(
        JSON.stringify(
          redactForLog({
            event: "push.sent_zero",
            route: "/api/notify",
            user_id: userId,
            sent: push.sent,
            retired: push.retired,
          })
        )
      );
    }
  } catch (err) {
    console.warn("Push delivery failed (notification stored):", err);
  }

  return NextResponse.json({ created: true }, { status: 201 });
}