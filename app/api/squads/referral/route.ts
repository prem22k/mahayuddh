import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/squads/referral { squad_id }
 *
 * Loop D (§56, §57): get the caller's personal invite link for a squad,
 * minting it the first time.
 *
 * Idempotent — one link per person per squad, so it is safe to call on every
 * page load and the link a member put in a bio keeps working.
 *
 * The token ATTRIBUTES; the squad invite code still authorises. Anyone who has
 * the code can join regardless of the token, which is what makes a
 * forwardable link safe to hand out.
 */
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Log in to get an invite link." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const squadId = typeof body.squad_id === "string" ? body.squad_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(squadId)) {
    return NextResponse.json({ error: "Which squad?" }, { status: 400 });
  }

  // Membership is checked here AND by a trigger on insert. The check here gives
  // a readable message; the trigger is what actually holds.
  const { data: member } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("squad_id", squadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "You are not a member of that squad." }, { status: 403 });
  }

  const { data: squad } = await supabase
    .from("squads")
    .select("id,name,invite_code")
    .eq("id", squadId)
    .maybeSingle();
  if (!squad) return NextResponse.json({ error: "No such squad." }, { status: 404 });

  const { data: existing } = await supabase
    .from("squad_referrals")
    .select("id,token,opens,joins")
    .eq("squad_id", squadId)
    .eq("referrer_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      token: existing.token,
      invite_code: squad.invite_code,
      squad_name: squad.name,
      path: `/squad/join/${squad.invite_code}?ref=${existing.token}`,
      opens: existing.opens,
      joins: existing.joins,
    });
  }

  // 24 hex characters: 96 bits, and every character is in [A-Za-z0-9].
  //
  // Hex rather than base64url on purpose. base64url emits `-` and `_`, which the
  // squad_referrals token CHECK constraint (`^[A-Za-z0-9]{12,24}$`) rejects — so
  // roughly a third of tokens could not be inserted at all. The first mint in a
  // test run passed by luck and the second failed; an integration check against
  // the live constraint is what found it.
  const token = randomBytes(12).toString("hex");

  const { data: created, error } = await supabase
    .from("squad_referrals")
    .insert({ squad_id: squadId, referrer_id: user.id, token })
    .select("id,token,opens,joins")
    .single();

  if (error) {
    // A concurrent request may have minted it first; that is success, not
    // failure, because the link works either way.
    const { data: raced } = await supabase
      .from("squad_referrals")
      .select("token,opens,joins")
      .eq("squad_id", squadId)
      .eq("referrer_id", user.id)
      .maybeSingle();
    if (raced) {
      return NextResponse.json({
        token: raced.token,
        invite_code: squad.invite_code,
        squad_name: squad.name,
        path: `/squad/join/${squad.invite_code}?ref=${raced.token}`,
        opens: raced.opens,
        joins: raced.joins,
      });
    }
    return NextResponse.json({ error: "Couldn't create an invite link." }, { status: 500 });
  }

  return NextResponse.json({
    token: created.token,
    invite_code: squad.invite_code,
    squad_name: squad.name,
    path: `/squad/join/${squad.invite_code}?ref=${created.token}`,
    opens: created.opens,
    joins: created.joins,
  });
}

/**
 * GET /api/squads/referral
 *
 * Every link this caller has sent and what came through it. The §57 metric
 * "invites/active user" is a ratio of these joins.
 */
export async function GET(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The user id is passed in because auth.uid() is NULL for a service-role
  // caller, which silently returned an empty list for everybody.
  const { data, error } = await supabase.rpc("my_referral_links", { p_user: user.id });
  if (error) return NextResponse.json({ error: "Couldn't load your links." }, { status: 500 });

  const links = (data ?? []) as {
    squad_id: string;
    squad_name: string;
    token: string;
    invite_code: string;
    opens: number;
    joins: number;
  }[];

  return NextResponse.json({
    links: links.map((l) => ({
      ...l,
      path: `/squad/join/${l.invite_code}?ref=${l.token}`,
    })),
  });
}
