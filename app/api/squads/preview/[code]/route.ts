import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// GET /api/squads/preview/[code]?ref=token — PUBLIC (invite links open for
// logged-out users).
//
// Returns squad card only: name, description, member count, sample members.
// No spoilers, no full member list, no activity history.
//
// When `?ref=` is present the open is counted against that link. An open is not
// a join and it grants nothing — it exists so a member can tell whether their
// link was ignored, which is the honest version of "invites sent".
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
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

  // Count the open, and tell the page who sent it so the invitee sees a name
  // rather than an anonymous squad.
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  let invitedBy: string | null = null;
  if (/^[A-Za-z0-9]{12,24}$/.test(ref)) {
    const { data: referral } = await supabase
      .from("squad_referrals")
      .select("id,referrer_id")
      .eq("token", ref)
      .eq("squad_id", squad.id)
      .maybeSingle();
    if (referral) {
      // Increment in SQL so two simultaneous opens cannot race the counter down.
      await supabase.rpc("count_referral_open", { p_referral_id: referral.id });
      const { data: referrer } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", (referral as { referrer_id: string }).referrer_id)
        .maybeSingle();
      invitedBy = (referrer as { username: string } | null)?.username ?? null;
    }
  }

  return NextResponse.json({
    squad,
    member_count: count ?? 0,
    sample_members: sample ?? [],
    invited_by: invitedBy,
  });
}
