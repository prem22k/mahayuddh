import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase/service";
import { buildPublicCard, BattleCardInput, formatDuration } from "@/lib/battleCard";
import type { Battle, ProblemEvent, Approach, Suggestion, Problem } from "@/types/database";

/**
 * Public battle card (Step 16, Bible §38).
 *
 * Reachable by logged-out visitors — that is the whole point of a share link
 * (§42). The page renders the PUBLIC projection only; it never reaches for the
 * approach text or the squad name, so there is nothing here to leak by accident.
 */

export const dynamic = "force-dynamic";

async function loadCard(id: string): Promise<{
  card: ReturnType<typeof buildPublicCard>;
  exists: boolean;
}> {
  const supabase = getServiceClient();
  if (!supabase) return { card: null as never, exists: false };

  const { data: battle } = await supabase
    .from("battles")
    .select(
      "id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!battle) return { card: null as never, exists: false };

  const slug = (battle.problem_slug as string).toLowerCase();
  const ownerId = battle.user_id as string;

  const [ownerRes, catalogRes, battlesRes, eventsRes, approachesRes, challengesRes] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", ownerId).maybeSingle(),
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

  return { card: buildPublicCard(input), exists: true };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { card, exists } = await loadCard(id);
  if (!exists) return { title: "Battle not found | Mahayuddh" };

  const solved = card.solvedSec != null ? formatDuration(card.solvedSec) : null;
  const who = card.ownerUsername ? `@${card.ownerUsername}` : "Someone";

  return {
    title: `${card.title} in ${solved ?? "one battle"} — ${who}`,
    description: `${who} solved ${card.title}${card.difficulty ? ` (${card.difficulty})` : ""}${
      solved ? ` in ${solved}` : ""
    }${card.isPersonalRecord ? " — personal best" : ""}. ${card.stats.attempts} attempts${
      card.stats.challengesSent ? `, challenged ${card.stats.challengesSent} people` : ""
    }.`,
    // A shared solve is worth indexing: it is the Loop B growth surface.
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
  const { card, exists } = await loadCard(id);
  if (!exists || !card) notFound();

  const solved = card.solvedSec != null ? formatDuration(card.solvedSec) : null;
  const prev = card.previousBestSec != null ? formatDuration(card.previousBestSec) : null;
  const who = card.ownerUsername ? `@${card.ownerUsername}` : "A Mahayuddh developer";

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">
              Battle
            </span>
            {card.difficulty && (
              <span className="px-2 py-0.5 rounded-full border border-white/[0.12] text-[10px] font-bold uppercase tracking-wider text-white/60">
                {card.difficulty}
              </span>
            )}
            {card.pattern && (
              <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white/50">
                {card.pattern}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{card.title}</h1>
          <p className="text-sm text-white/50">
            {who} · {new Date(card.startedAt ?? new Date().toISOString()).toLocaleDateString()}
          </p>
        </header>

        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-6">
          <div className="text-4xl font-black font-mono">{solved ?? "—"}</div>
          <div className="text-xs text-white/40 mt-1">
            {prev ? (
              <>
                Previous best <span className="font-mono text-white/60">{prev}</span>
              </>
            ) : (
              "First timed solve"
            )}
          </div>
          {card.isPersonalRecord && (
            <div className="mt-3 inline-block px-2 py-0.5 rounded-full bg-[#30d158]/15 border border-[#30d158]/30 text-[10px] font-bold text-[#30d158]">
              Personal best
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: "Attempts", value: card.stats.attempts },
            { label: "Revisits", value: card.stats.revisits },
            { label: "Challenged out", value: card.stats.challengesSent },
            { label: "Friends solved it", value: card.stats.friendsCompleted },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-2xl font-black font-mono">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </dl>

        {/* Provenance is stated, not implied. Solved is not the same as understood. */}
        <p className="text-xs text-white/35">
          {card.evidence === "leetcode"
            ? "Solved with LeetCode evidence."
            : "Self-reported solve — logged by the developer, not independently verified."}
        </p>

        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-lg font-bold">Solve the same problem</h2>
          <p className="text-xs text-white/45">
            Practice DSA with people you know. Solve it, then challenge them with it.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all"
            >
              Start solving
            </Link>
            <Link
              href={`/practice/${card.problemSlug}`}
              className="px-5 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold transition-all"
            >
              See the problem
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}