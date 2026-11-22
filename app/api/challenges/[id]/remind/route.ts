import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { inQuietHoursIST } from "@/lib/quietHours";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MS = 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/challenges/:id/remind
 *
 * A reminder is an action on one existing challenge, not a free-form push
 * relay. The caller must be one of its two people; the recipient, actor,
 * content, and throttle key are all derived here from that challenge.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const auth = await requireUser(request, "/api/challenges/[id]/remind");
  if (auth.response) return auth.response;
  const caller = auth.user;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "No such challenge.", reason: "not_party" }, { status: 404 });

  const limit = rateLimit({
    ...RATE_RULES.challengeReminder,
    key: rateLimitKey("challengeReminder", { userId: caller.id }),
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many reminder attempts. Try again shortly.", reason: "throttled" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const { data: challenge, error: readError } = await supabase
    .from("suggestions")
    .select("id,from_user,to_user,status,reminded_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "Couldn't read that challenge." }, { status: 500 });
  if (!challenge || (challenge.from_user !== caller.id && challenge.to_user !== caller.id)) {
    return NextResponse.json({ error: "No such challenge.", reason: "not_party" }, { status: 404 });
  }
  if (challenge.status !== "pending") {
    return NextResponse.json({ error: "That challenge is no longer pending.", reason: "not_pending" }, { status: 409 });
  }

  const now = new Date();
  if (challenge.reminded_at && now.getTime() - Date.parse(challenge.reminded_at) < REMINDER_WINDOW_MS) {
    return NextResponse.json({ error: "This challenge was already nudged recently.", reason: "throttled" }, { status: 429 });
  }

  // Atomic compare-and-set: only one request across tabs/devices can claim the
  // challenge's 24-hour reminder window.
  const cutoff = new Date(now.getTime() - REMINDER_WINDOW_MS).toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("suggestions")
    .update({ reminded_at: now.toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .or(`reminded_at.is.null,reminded_at.lt.${cutoff}`)
    .select("id,reminded_at")
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: "Couldn't send that reminder." }, { status: 500 });
  if (!updated) {
    const { data: current } = await supabase
      .from("suggestions")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (current?.status !== "pending") {
      return NextResponse.json({ error: "That challenge is no longer pending.", reason: "not_pending" }, { status: 409 });
    }
    return NextResponse.json({ error: "This challenge was already nudged recently.", reason: "throttled" }, { status: 429 });
  }

  // Keep the existing quiet-hours contract: the action is recorded, but no
  // notification row is queued overnight. The bell remains the only push
  // delivery path for this event.
  if (!inQuietHoursIST(now)) {
    const recipient = challenge.from_user === caller.id ? challenge.to_user : challenge.from_user;
    const deepLink = `/c/${id}`;
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: recipient,
      kind: "challenge",
      title: "Challenge reminder",
      body: "Someone nudged you about a pending challenge.",
      deep_link: deepLink,
      actor_id: caller.id,
      dedupe_key: `challenge-reminder:${id}:${Date.parse(updated.reminded_at ?? now.toISOString())}`,
    });

    if (insertError) {
      // Do not consume the 24-hour allowance when the notification could not be
      // queued. Match the exact timestamp so this cannot undo a later claim.
      await supabase
        .from("suggestions")
        .update({ reminded_at: challenge.reminded_at })
        .eq("id", id)
        .eq("reminded_at", updated.reminded_at);
      return NextResponse.json({ error: "Couldn't queue that reminder." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
