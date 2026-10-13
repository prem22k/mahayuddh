import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ExternalLink } from "lucide-react";
import { getServiceClient } from "@/lib/supabase/service";
import { buildPublicCard, BattleCardInput, formatDuration } from "@/lib/battleCard";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
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
  const verified = card.evidence === "leetcode";
  const who = card.ownerUsername ? `@${card.ownerUsername}` : "A Mahayuddh developer";
  const dateLine = new Date(card.startedAt ?? new Date().toISOString())
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const noLine = card.problemSlug ? `NO. ${card.problemSlug}` : "NO. 3";

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <span className="font-display text-lg font-semibold tracking-tight">Mahayuddh</span>
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-6">
        <div className="pass">
          <div className="pass-body space-y-4">
            <h1 className="font-display text-4xl font-semibold leading-none tracking-tight md:text-[44px]">
              {card.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {card.difficulty && (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-medium leading-4 text-text-secondary">
                  {card.difficulty}
                </span>
              )}
              {card.pattern && (
                <span className="inline-flex h-6 items-center rounded-full bg-pattern-tint px-2.5 text-xs font-medium leading-4 text-pattern">
                  {card.pattern}
                </span>
              )}
            </div>
            <div className="type-mono-display tnum">{solved ?? "—"}</div>
            <p className="text-sm leading-6 text-text-secondary">
              {prev ? (
                <>
                  <span className="line-through">{prev}</span>
                  {" → "}
                  <span className="font-mono tnum">{solved}</span>
                  {" · faster"}
                </>
              ) : (
                "First timed solve"
              )}
              {card.isPersonalRecord && (
                <span className="ml-2 inline-flex h-6 items-center rounded-sm bg-primary-tint px-2 text-xs font-medium leading-4 text-primary">
                  Personal best
                </span>
              )}
            </p>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay text-xs font-medium text-text-secondary">
                {(card.ownerUsername ?? "M").slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm leading-6 text-text-secondary">{who}</span>
            </div>
          </div>
          <div className="pass-stub">
            <div className="pass-serial">{who.toUpperCase().slice(0, 12)}</div>
            <div className="pass-serial">{dateLine}</div>
            <div className="pass-serial">{noLine.toUpperCase()}</div>
            {verified ? (
              <div className="seal-bloom mt-2 flex h-12 w-12 animate-stamp items-center justify-center rounded-full border border-verified/30">
                <span className="flex flex-col items-center text-verified">
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                  <span className="font-mono text-[10px] font-medium tracking-widest">VERIFIED</span>
                </span>
              </div>
            ) : (
              <div className="pass-serial mt-2">SELF-REPORTED</div>
            )}
          </div>
        </div>

        <p className="text-center text-xs leading-4 text-text-tertiary">
          {card.stats.attempts} attempts · {card.stats.revisits} revisits · challenged {card.stats.challengesSent} ·{" "}
          {card.stats.friendsCompleted} friends solved it
        </p>
        <p className="text-center text-sm leading-6 text-text-secondary">
          {verified
            ? "Verified against an accepted LeetCode submission."
            : "Logged without a LeetCode match."}
        </p>

        <Suspense fallback={null}>
          <TrackVisit artifact={`battle:${id}`} />
        </Suspense>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-12 min-h-[44px] items-center rounded-md bg-primary px-6 text-sm font-medium leading-5 text-on-primary hover:bg-primary-hover"
          >
            Try this problem
          </Link>
          <a
            href={`https://leetcode.com/problems/${card.problemSlug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary"
          >
            See it on LeetCode
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
          </a>
          <ShareRow
            path={`/b/${id}`}
            artifact={{ kind: "battle", id }}
            text={`I solved ${card.title} on Mahayuddh${solved ? ` in ${solved}` : ""}.`}
            label="Share"
          />
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-2 pt-6 text-xs leading-4 text-text-tertiary">
          <span>Mahayuddh · Practice DSA with your people</span>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px]"
          >
            Start your squad
          </Link>
        </footer>
      </main>
    </div>
  );
}
