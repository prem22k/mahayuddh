import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { randomInviteCode } from "@/lib/security/inviteCode";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

// POST /api/squads {name, description?} — create squad, join as admin.
// Solo users unaffected: nothing else changes on creation.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/squads");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.squadCreate,
    key: rateLimitKey("squadCreate", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", { route: "/api/squads", actor_id: user.id });
    return NextResponse.json(
      { error: "You've created several squads already. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 500)
      : null;
  if (!name) return NextResponse.json({ error: "Squad name is required (max 60 chars)." }, { status: 400 });

  // Unique invite code with bounded retries. randomInviteCode() uses the CSPRNG;
  // see lib/security/inviteCode.ts for why Math.random() was not good enough —
  // this string is what authorises a join.
  let inviteCode = "";
  let squad: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5 && !squad; attempt++) {
    inviteCode = randomInviteCode();
    const { data, error } = await supabase
      .from("squads")
      .insert({ name, description, created_by: user.id, invite_code: inviteCode })
      .select("*")
      .maybeSingle();
    if (!error && data) squad = data;
    else if (error && error.code !== "23505") {
      return NextResponse.json({ error: "Couldn't create squad. Try again." }, { status: 500 });
    }
  }
  if (!squad) return NextResponse.json({ error: "Couldn't create squad. Try again." }, { status: 500 });

  const squadId = (squad as { id: string }).id;
  const { error: mErr } = await supabase
    .from("squad_members")
    .insert({ squad_id: squadId, user_id: user.id, role: "admin" });
  if (mErr) {
    await supabase.from("squads").delete().eq("id", squadId);
    return NextResponse.json({ error: "Couldn't create squad. Try again." }, { status: 500 });
  }
  // First squad becomes active automatically; existing users keep theirs.
  await supabase.from("profiles").update({ active_squad_id: squadId }).eq("id", user.id).is("active_squad_id", null);

  return NextResponse.json({ success: true, squad }, { status: 201 });
}
