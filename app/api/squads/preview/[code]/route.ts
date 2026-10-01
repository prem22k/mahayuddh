import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// GET /api/squads/preview/[code] — PUBLIC (invite links open for logged-out users).
// Returns squad card only: name, description, member count, sample members.
// No spoilers, no full member list, no activity history.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const code = (await params).code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return NextResponse.json({ error: "Bad invite code." }, { status: 400 });

  const { data: squad } = await supabase
    .from("squads")
    .select("id, name, description, created_at")
    .eq("invite_code", code)
    .maybeSingle();
  if (!squad) return NextResponse.json({ error: "No squad found for that code." }, { status: 404 });

  const { count } = await supabase
    .from("squad_members")
    .select("squad_id", { count: "exact", head: true })
    .eq("squad_id", squad.id);
  const { data: sample } = await supabase
    .from("squad_members")
    .select("profile:user_id (username, avatar_url)")
    .eq("squad_id", squad.id)
    .order("joined_at", { ascending: true })
    .limit(5);

  return NextResponse.json({ squad, member_count: count ?? 0, sample_members: sample ?? [] });
}
