import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { validatePushEndpoint } from "@/lib/security/pushEndpoint";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe {endpoint, keys:{p256dh,auth}}
 * The other half of lib/push.ts: without this, push_subscriptions stays empty
 * and sendPushToUser has nobody to talk to.
 */
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/push/subscribe");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.push,
    key: rateLimitKey("push", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/push/subscribe",
      actor_id: user.id,
    });
    return NextResponse.json(
      { error: "Too many subscribe attempts." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const p256dh = typeof (body.keys as Record<string, unknown> | undefined)?.p256dh === "string"
    ? ((body.keys as Record<string, unknown>).p256dh as string)
    : "";
  const authSecret = typeof (body.keys as Record<string, unknown> | undefined)?.auth === "string"
    ? ((body.keys as Record<string, unknown>).auth as string)
    : "";

  /**
   * Host allowlist, not a scheme check.
   *
   * This table is a queue of URLs our server will POST to, written by the
   * client. The previous guard accepted any `https://<host>/` and its comment
   * claimed it prevented the server probing internal addresses — it did not,
   * because `https://169.254.169.254/` matches it. That is textbook SSRF: pick
   * the host, our server makes the request, and the status code comes back
   * through /api/push/deliver. The push services are a known, small set, so the
   * allowlist in lib/security/pushEndpoint.ts is the control that holds.
   */
  const verdict = validatePushEndpoint(body.endpoint);
  if (!verdict.ok || !verdict.endpoint) {
    logSecurityEvent("ssrf.rejected", {
      route: "/api/push/subscribe",
      actor_id: user.id,
      detail: `push endpoint rejected: ${verdict.reason}`,
    });
    return NextResponse.json({ error: "Bad push endpoint." }, { status: 400 });
  }

  if (!p256dh || !authSecret) {
    return NextResponse.json({ error: "endpoint and keys are required." }, { status: 400 });
  }
  // Key material is fixed-length base64url; anything else is not a subscription.
  if (p256dh.length > 256 || authSecret.length > 256) {
    return NextResponse.json({ error: "Bad push keys." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: verdict.endpoint, p256dh, auth: authSecret },
    { onConflict: "user_id,endpoint" }
  );
  if (error) {
    return NextResponse.json({ error: "Couldn't subscribe to push." }, { status: 500 });
  }
  return NextResponse.json({ subscribed: true }, { status: 201 });
}

/** DELETE /api/push/subscribe — opt out from this device. */
export async function DELETE(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/push/subscribe");
  if (auth.response) return auth.response;
  const user = auth.user;

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const rawEndpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!rawEndpoint) return NextResponse.json({ error: "endpoint is required." }, { status: 400 });

  // Same allowlist as subscribe: the delete is scoped to the caller's own rows,
  // so this only has to canonicalise, but it should not be the one code path
  // that stores a spelling the subscribe route would have rejected.
  const verdict = validatePushEndpoint(rawEndpoint);
  if (!verdict.ok || !verdict.endpoint) {
    return NextResponse.json({ error: "Bad push endpoint." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", verdict.endpoint);
  if (error) return NextResponse.json({ error: "Couldn't unsubscribe." }, { status: 500 });
  return NextResponse.json({ unsubscribed: true });
}