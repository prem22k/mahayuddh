import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { rateLimit, rateLimitKey, RATE_RULES, clientIp } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

// POST /api/squads/join {invite_code, ref?}
//
// The code is validated server-side: RLS has no client INSERT on squad_members,
// so a code cannot be bypassed by guessing a squad id.
//
// `ref` is the Loop D referral token. It does NOT authorise anything — the
// invite code above still does. It only attributes the join to the person who
// sent the link, so "invites/active user" (§57) is measurable. An absent,
// unknown or self-referential token joins exactly the same as no token at all.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/squads/join");
  if (auth.response) return auth.response;
  const user = auth.user;

  /**
   * An invite code is the thing that authorises a join, so this endpoint is the
   * one place where unlimited attempts is unlimited squad access. Two caps: a
   * tight one per account, and a much looser one per address to catch account
   * rotation without punishing a shared office or campus network.
   */
  const byUser = rateLimit({
    ...RATE_RULES.squadJoin,
    key: rateLimitKey("squadJoin", { userId: user.id }),
  });
  const ip = clientIp(request);
  const byIp = rateLimit({
    ...RATE_RULES.squadJoinByIp,
    key: rateLimitKey("squadJoinByIp", { ip }),
  });
  if (!byUser.ok || !byIp.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/squads/join",
      actor_id: user.id,
      ip,
    });
    const retryAfter = Math.max(byUser.retryAfterSec, byIp.retryAfterSec);
    return NextResponse.json(
      { error: "Too many join attempts. Wait a bit." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const code = typeof body.invite_code === "string" ? body.invite_code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Invite code looks wrong — 8 letters/digits." }, { status: 400 });
  }

  const { data: squad } = await supabase.from("squads").select("*").eq("invite_code", code).maybeSingle();
  if (!squad) return NextResponse.json({ error: "No squad found for that code." }, { status: 404 });

  // Attribution first, so a self-invite is ignored rather than honoured and the
  // join proceeds either way.
  const refToken = typeof body.ref === "string" ? body.ref : "";
  let invitedBy: string | null = null;
  if (/^[A-Za-z0-9]{12,24}$/.test(refToken)) {
    const { data: attributed, error: attrErr } = await supabase.rpc("attribute_join", {
      p_referral_token: refToken,
      p_squad_id: squad.id,
      p_user_id: user.id,
    });
    // Logged rather than swallowed: an attribution failure must not block the
    // join, but it must not be invisible either. This exact silence hid a
    // plpgsql type error that meant nobody was ever credited.
    if (attrErr) console.warn("attribute_join failed:", attrErr.message);
    const row = (attributed ?? [])[0] as { referrer_username: string | null } | undefined;
    invitedBy = row?.referrer_username ?? null;
  }

  const { data: existing } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("squad_id", squad.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    const { data: count } = await supabase
      .from("squad_members")
      .select("squad_id", { count: "exact", head: true })
      .eq("squad_id", squad.id);
    if (typeof count === "number" && count >= 30) {
      return NextResponse.json({ error: "This squad is full (30 members max)." }, { status: 400 });
    }
    const { error: jErr } = await supabase
      .from("squad_members")
      .insert({ squad_id: squad.id, user_id: user.id, role: "member" });
    if (jErr) return NextResponse.json({ error: "Couldn't join squad. Try again." }, { status: 500 });
  }

  await supabase.from("profiles").update({ active_squad_id: squad.id }).eq("id", user.id).is("active_squad_id", null);

  return NextResponse.json({
    success: true,
    squad,
    // Null when nobody referred them, which is most joins. The UI must not
    // invent a referrer when this is null.
    invited_by: invitedBy,
  });
}
