import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase/service";
import { safeNext } from "@/lib/safeNext";
import { buildPublicCard, BattleCardInput, formatDuration } from "@/lib/battleCard";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { ProofView } from "@/components/proof/ProofView";
import type { Battle, BattleOutcome, ProblemEvent, Approach, Suggestion, Problem } from "@/types/database";

/**
 * Public battle card (Step 16, Bible §38).
 *
 * Reachable by logged-out visitors — that is the whole point of a share link
 * (§42). The page renders the PUBLIC projection only; it never reaches for the
 * approach text or the squad name, so there is nothing here to leak by accident.
 */

export const dynamic = "force-dynamic";

/** Battle-row facts the public card projection does not carry. */
interface ProofFacts {
  outcome: BattleOutcome;
  durationSec: number | null;
  /** ended_at, or started_at while the battle runs. */
  at: string;
  /** LeetCode frontend number from the catalog, when the catalog has the problem. */
  questionId: string | null;
  ownerAvatar: string | null;
}

async function loadCard(id: string): Promise<{
  card: ReturnType<typeof buildPublicCard>;
  facts: ProofFacts;
  exists: boolean;
}> {
  const supabase = getServiceClient();
  if (!supabase) return { card: null as never, facts: null as never, exists: false };

  const { data: battle } = await supabase
    .from("battles")
    .select(
      "id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!battle) return { card: null as never, facts: null as never, exists: false };

  const slug = (battle.problem_slug as string).toLowerCase();
  const ownerId = battle.user_id as string;

  const [ownerRes, catalogRes, battlesRes, eventsRes, approachesRes, challengesRes] =
    await Promise.all([
      supabase.from("profiles").select("username,avatar_url").eq("id", ownerId).maybeSingle(),
      supabase
        .from("problems")
        .select("title_slug,title,difficulty,question_id,topics")
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
    battle: battle as Battle,
    ownerUsername: (ownerRes.data as { username: string } | null)?.username ?? null,
    squadName: null, // Never exposed publicly.
    problem: (catalogRes.data as Problem | null) ?? null,
    allBattles: (battlesRes.data ?? []) as Battle[],
    events: (eventsRes.data ?? []) as ProblemEvent[],
    approaches: (approachesRes.data ?? []) as Approach[],
    challenges: (challengesRes.data ?? []) as Suggestion[],
  };

  const row = battle as Battle;
  const qid = (catalogRes.data as Problem | null)?.question_id;
  const facts: ProofFacts = {
    outcome: row.outcome,
    durationSec: row.duration_sec,
    at: row.ended_at ?? row.started_at,
    questionId: qid ? String(qid) : null,
    ownerAvatar: (ownerRes.data as { avatar_url: string | null } | null)?.avatar_url ?? null,
  };

  return { card: buildPublicCard(input), facts, exists: true };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { card, facts, exists } = await loadCard(id);
  if (!exists) return { title: "Battle not found | Mahayuddh" };

  const solved = card.solvedSec != null ? formatDuration(card.solvedSec) : null;
  const who = card.ownerUsername ? `@${card.ownerUsername}` : "Someone";

  // An unsolved battle is still shareable, but its preview must not say "solved".
  if (facts.outcome !== "solved") {
    return {
      title: `${card.title} — ${who}'s battle`,
      description: `${who} battled ${card.title}${card.difficulty ? ` (${card.difficulty})` : ""}. Not solved yet.`,
      openGraph: { title: `${who} battled ${card.title}`, description: "Not solved yet", type: "article" },
    };
  }

  return {
    title: `${card.title} in ${solved ?? "one battle"} — ${who}`,
    description: `${who} solved ${card.title}${card.difficulty ? ` (${card.difficulty})` : ""}${
      solved ? ` in ${solved}` : ""
    }${card.isPersonalRecord ? " — personal best" : ""}. ${card.stats.attempts} attempts${
      card.stats.challengesSent ? `, challenged ${card.stats.challengesSent} people` : ""
    }.`,
    openGraph: {
      title: `${who} solved ${card.title}`,
      description: solved ? `Solved in ${solved}` : "Solved",
      type: "article",
    },
  };
}

export default async function BattleSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { card, facts, exists } = await loadCard(id);
  if (!exists || !card) notFound();

  const solved = card.solvedSec != null ? formatDuration(card.solvedSec) : null;

  // Deep-continue (Wave D): every CTA carries ?next=<artifact> through
  // safeNext, so a logged-out visitor lands back on this battle after auth
  // instead of a generic page. Login already honors ?next=.
  const artifactPath = `/b/${id}`;
  const nextParam = encodeURIComponent(safeNext(artifactPath) ?? "/home");
  const shareText =
    facts.outcome === "solved"
      ? `I solved ${card.title} on Mahayuddh${solved ? ` in ${solved}` : ""}.`
      : `I battled ${card.title} on Mahayuddh.`;

  return (
    <>
      <Suspense fallback={null}>
        <TrackVisit artifact={`battle:${id}`} />
      </Suspense>
      <ProofView
        battleId={id}
        card={card}
        outcome={facts.outcome}
        durationSec={facts.durationSec}
        at={facts.at}
        questionId={facts.questionId}
        ownerAvatar={facts.ownerAvatar}
        signInHref={`/login?next=${nextParam}`}
        signupHref={`/login?mode=signup&next=${nextParam}`}
        shareText={shareText}
      />
    </>
  );
}
