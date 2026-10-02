import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

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
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
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
