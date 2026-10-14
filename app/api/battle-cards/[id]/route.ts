import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { buildBattleCard, buildPublicCard, BattleCardInput } from "@/lib/battleCard";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/battle-cards/[id]
 *
 * The card is the shareable artifact (§38), so this route is public. It reads
 * with the service key because `battles` is own-row under RLS — a stranger
 * cannot see your sessions by design, and a share link still has to work.
 *
 * That makes this route the single place where private data could leak, so the
 * rule is: a caller who is not the owner and not in the owner's active squad
 * gets `buildPublicCard` and nothing else. The scratchpad is never selected
 * here at all.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: battle, error: battleErr } = await supabase
    .from("battles")
    .select(
      "id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (battleErr) {
    return NextResponse.json({ error: "Couldn't load this card." }, { status: 500 });
  }
  if (!battle) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const slug = (battle.problem_slug as string).toLowerCase();
  const ownerId = battle.user_id as string;

  const [ownerRes, squadRes, catalogRes, battlesRes, eventsRes, approachesRes, challengesRes] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", ownerId).maybeSingle(),
      battle.squad_id
        ? supabase.from("squads").select("name").eq("id", battle.squad_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("problems")
        .select("title_slug,title,difficulty,topics")
        .eq("title_slug", slug)
        .maybeSingle(),
      supabase
        .from("battles")
        .select("id,problem_slug,started_at,duration_sec,outcome,user_id")
        .eq("user_id", ownerId)
        .eq("problem_slug", slug)
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("problem_events")
        .select("id,problem_slug,kind,duration_sec,created_at")
        .eq("user_id", ownerId)
        .eq("problem_slug", slug)
        .order("created_at", { ascending: false })
        .limit(100),
      // Own approaches only. The public projection decides what a stranger sees;
      // here we only decide what is *available*.
      supabase
        .from("approaches")
        .select("id,user_id,problem_slug,core_idea,visibility,created_at")
        .eq("user_id", ownerId)
        .eq("problem_slug", slug)
        .limit(5),
      supabase
        .from("suggestions")
        .select("id,from_user,to_user,problem_slug,status,created_at")
        .or(`from_user.eq.${ownerId},to_user.eq.${ownerId}`)
        .eq("problem_slug", slug)
        .limit(50),
    ]);

  const input: BattleCardInput = {
    battle: battle as BattleCardInput["battle"],
    ownerUsername: (ownerRes.data as { username: string } | null)?.username ?? null,
    squadName: (squadRes.data as { name: string } | null)?.name ?? null,
    problem: (catalogRes.data as BattleCardInput["problem"]) ?? null,
    allBattles: (battlesRes.data ?? []) as BattleCardInput["allBattles"],
    events: (eventsRes.data ?? []) as BattleCardInput["events"],
    approaches: (approachesRes.data ?? []) as BattleCardInput["approaches"],
    challenges: (challengesRes.data ?? []) as BattleCardInput["challenges"],
  };

  // Who is asking? Anonymous is a normal case here, not an error.
  const viewer = await resolveUser(extractBearerToken(request));
  const viewerId = viewer?.id ?? null;

  let isOwner = false;
  let isSquadMember = false;
  if (viewerId) {
    isOwner = viewerId === ownerId;
    if (!isOwner && battle.squad_id) {
      const { data: mem } = await supabase
        .from("squad_members")
        .select("squad_id")
        .eq("squad_id", battle.squad_id)
        .eq("user_id", viewerId)
        .maybeSingle();
      isSquadMember = Boolean(mem);
    }
  }

  if (!isOwner && !isSquadMember) {
    if (viewerId) {
      track("invite_opened", { battle_id: id, via: "battle_card" });
    }
    return NextResponse.json({ card: buildPublicCard(input), viewer: "public" });
  }

  return NextResponse.json({
    card: buildBattleCard(input),
    viewer: isOwner ? "owner" : "squad",
  });
}
