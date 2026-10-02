import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

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
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
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
    return NextResponse.json(result);
  } catch {
    // A push failure is not the bell's problem. The row is still unread and the
    // bell still shows it in-app.
    return NextResponse.json({ sent: 0, retired: 0 });
  }
}