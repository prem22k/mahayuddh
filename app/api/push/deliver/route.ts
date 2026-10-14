import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";
import { readJsonBounded } from "@/lib/security/body";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { logSecurityEvent, redactForLog } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/deliver {id}
 *
 * Delivers one of the caller's OWN unread notifications as a push.
 *
 * Why a route and not a direct call from the bell: sendPushToUser needs the
 * service key and the VAPID private key, so it cannot run in the browser. The
 * database triggers write rows, a Postgres trigger cannot call lib/push.ts, and
 * inventing an HTTP extension for six notification kinds would be a lot of
 * machinery to avoid one round trip.
 *
 * So the row is the queue and this route drains it.
 *
 * Takes a notification id rather than arbitrary title/body text on purpose. That
 * makes it impossible to use this endpoint as a push relay: the content always
 * comes from a row the caller already owns.
 */
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/push/deliver");
  if (auth.response) return auth.response;
  const user = auth.user;

  // Each call is an outbound request to a push provider. The content is always
  // the caller's own unread row, so this cannot be used as a relay — but it can
  // be used to burn the app's push quota, so it is capped.
  const limit = rateLimit({
    ...RATE_RULES.push,
    key: rateLimitKey("push", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/push/deliver",
      actor_id: user.id,
    });
    return NextResponse.json(
      { error: "Too many push attempts." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("notifications")
    .select("id,title,body,deep_link,read_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Couldn't read that notification." }, { status: 400 });
  // Not found and not-yours are the same answer, so this cannot be used to probe
  // for whether somebody else has a notification with a given id.
  if (!row) return NextResponse.json({ error: "No such notification." }, { status: 404 });

  try {
    const result = await sendPushToUser(user.id, {
      title: row.title,
      body: row.body ?? undefined,
      url: row.deep_link ?? undefined,
    });
    if (result.sent === 0) {
      console.warn(
        JSON.stringify(
          redactForLog({
            event: "push.sent_zero",
            route: "/api/push/deliver",
            user_id: user.id,
            sent: result.sent,
            retired: result.retired,
          })
        )
      );
    }
    return NextResponse.json(result);
  } catch {
    // A push failure is not the bell's problem. The row is still unread and the
    // bell still shows it in-app.
    return NextResponse.json({ sent: 0, retired: 0 });
  }
}