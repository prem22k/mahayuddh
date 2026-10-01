import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

// POST /api/squads/switch {squad_id} — one active squad in UX; caller must be a member.
// profiles.active_squad_id is server-written (clients can't update profiles).
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const squadId = typeof body.squad_id === "string" ? body.squad_id : "";
  if (!squadId) return NextResponse.json({ error: "squad_id is required." }, { status: 400 });

  const { data: membership } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("squad_id", squadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Join this squad before switching to it." }, { status: 403 });

  const { error } = await supabase.from("profiles").update({ active_squad_id: squadId }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't switch squad. Try again." }, { status: 500 });
  return NextResponse.json({ success: true, active_squad_id: squadId });
}
