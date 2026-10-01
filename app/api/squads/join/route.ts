import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

// POST /api/squads/join {invite_code} — code validated server-side (RLS has no
// client INSERT on squad_members, so codes can't be bypassed by id).
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
  return NextResponse.json({ success: true, squad });
}
