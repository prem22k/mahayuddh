import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe {endpoint, keys:{p256dh,auth}}
 * The other half of lib/push.ts: without this, push_subscriptions stays empty
 * and sendPushToUser has nobody to talk to.
 */
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "endpoint and keys are required." }, { status: 400 });
  }

  // Push endpoints are opaque URLs handed out by the browser. Reject anything
  // that isn't https to an fcm.googleapis.com-style host so this table can't be
  // used to make the server probe internal addresses.
  if (!/^https:\/\/[a-z0-9.-]+\//i.test(endpoint)) {
    return NextResponse.json({ error: "Bad push endpoint." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth },
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
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "endpoint is required." }, { status: 400 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "Couldn't unsubscribe." }, { status: 500 });
  return NextResponse.json({ unsubscribed: true });
}