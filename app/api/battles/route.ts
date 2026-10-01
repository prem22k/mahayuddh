import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

// POST /api/battles {action: start|heartbeat|end, ...}
// Private sessions (Bible Principle 6): server verifies ownership on every write.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "start") {
    const slug = typeof body.problem_slug === "string" ? body.problem_slug.toLowerCase() : "";
    if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Bad problem slug." }, { status: 400 });
    let squadId: string | null = null;
    if (typeof body.squad_id === "string" && body.squad_id) {
      const { data: mem } = await supabase
        .from("squad_members")
        .select("squad_id")
        .eq("squad_id", body.squad_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mem) squadId = body.squad_id;
    } else {
      const { data: prof } = await supabase.from("profiles").select("active_squad_id").eq("id", user.id).maybeSingle();
      squadId = (prof as { active_squad_id: string | null } | null)?.active_squad_id ?? null;
    }
    // Attach the challenge being answered, if any (plan Step 10). Verified as
    // "mine to accept" so a battle can't be linked to someone else's challenge.
    let challengeId: string | null = null;
    if (typeof body.challenge_id === "string" && body.challenge_id) {
      const { data: chal } = await supabase
        .from("suggestions")
        .select("id, to_user")
        .eq("id", body.challenge_id)
        .eq("to_user", user.id)
        .maybeSingle();
      if (chal) challengeId = body.challenge_id;
    }

    // Honesty guard: previous live session becomes abandoned (one live timer each).
    await supabase.from("battles").update({ outcome: "abandoned", ended_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("outcome", "in_progress");
    const { data, error } = await supabase
      .from("battles")
      .insert({ user_id: user.id, problem_slug: slug, squad_id: squadId, challenge_id: challengeId })
      .select("*")
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Couldn't start battle. Try again." }, { status: 500 });
    return NextResponse.json({ success: true, battle: data }, { status: 201 });
  }

  if (action === "heartbeat") {
    const battleId = typeof body.battle_id === "string" ? body.battle_id : "";
    if (!battleId) return NextResponse.json({ error: "battle_id is required." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof body.scratchpad_md === "string") {
      if (body.scratchpad_md.length > 20000) {
        return NextResponse.json({ error: "Scratchpad too long (20k cap)." }, { status: 400 });
      }
      patch.scratchpad_md = body.scratchpad_md;
    }
    if (typeof body.duration_sec === "number" && Number.isFinite(body.duration_sec) && body.duration_sec >= 0) {
      patch.duration_sec = Math.trunc(body.duration_sec);
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ success: true });
    const { error } = await supabase.from("battles").update(patch).eq("id", battleId).eq("user_id", user.id).eq("outcome", "in_progress");
    if (error) return NextResponse.json({ error: "Couldn't save session." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "end") {
    const battleId = typeof body.battle_id === "string" ? body.battle_id : "";
    const outcome = body.outcome;
    if (!battleId) return NextResponse.json({ error: "battle_id is required." }, { status: 400 });
    if (!["solved", "failed", "abandoned"].includes(outcome)) {
      return NextResponse.json({ error: "Bad outcome." }, { status: 400 });
    }
    const patch: Record<string, unknown> = {
      outcome,
      ended_at: new Date().toISOString(),
      evidence: body.evidence === "leetcode" ? "leetcode" : "none",
    };
    if (typeof body.duration_sec === "number" && body.duration_sec >= 0) patch.duration_sec = Math.trunc(body.duration_sec);
    if (typeof body.scratchpad_md === "string" && body.scratchpad_md.length <= 20000) patch.scratchpad_md = body.scratchpad_md;
    if (typeof body.confidence === "number" && body.confidence >= 1 && body.confidence <= 5) {
      patch.confidence = Math.trunc(body.confidence);
    }
    const { data, error } = await supabase
      .from("battles")
      .update(patch)
      .eq("id", battleId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Couldn't end battle. Try again." }, { status: 500 });
    return NextResponse.json({ success: true, battle: data });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
