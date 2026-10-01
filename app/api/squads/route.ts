import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// POST /api/squads {name, description?} — create squad, join as admin.
// Solo users unaffected: nothing else changes on creation.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 500)
      : null;
  if (!name) return NextResponse.json({ error: "Squad name is required (max 60 chars)." }, { status: 400 });

  // Unique invite code with bounded retries.
  let inviteCode = "";
  let squad: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5 && !squad; attempt++) {
    inviteCode = randomCode();
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
