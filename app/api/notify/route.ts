import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
} from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const KINDS = ["challenge", "challenge_completed", "goal", "revenge", "recap", "contest"] as const;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;

function inQuietHours(now: Date): boolean {
  const hour = now.getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

// POST /api/notify {userId, kind, title, body?, deepLink?, actorId?, urgent?}
// The notifications table has no client INSERT policy, so writes are service-role
// only and this route is the single writer. Notifications always target somebody
// other than the caller (no "you notified yourself" loops).
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const caller = await resolveUser(extractBearerToken(request));
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 500) : null;
  const actorId = typeof body.actorId === "string" ? body.actorId : caller.id;
  const urgent = body.urgent === true;

  if (!userId || !KINDS.includes(kind as (typeof KINDS)[number]) || !title) {
    return NextResponse.json({ error: "userId, a known kind, and a title are required." }, { status: 400 });
  }
  if (userId === caller.id) {
    return NextResponse.json({ error: "Can't notify yourself." }, { status: 400 });
  }

  // Quiet hours: batchable nudges (goal / recap) are suppressed, direct
  // challenge pings are not — someone is waiting on a reply.
  const BATCHABLE = new Set(["goal", "recap", "contest"]);
  if (!urgent && BATCHABLE.has(kind) && inQuietHours(new Date())) {
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
    actor_id: actorId,
  });

  if (error) {
    return NextResponse.json({ error: "Couldn't create notification" }, { status: 500 });
  }

  // Push is a nice-to-have: a push failure must not undo the in-app record.
  try {
    const { sendPushToUser } = await import("@/lib/push");
    await sendPushToUser(userId, { title, body: text ?? undefined, url: deepLink ?? "/" });
  } catch (err) {
    console.warn("Push delivery failed (notification stored):", err);
  }

  return NextResponse.json({ created: true }, { status: 201 });
}