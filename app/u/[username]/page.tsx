import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicJourney } from "@/lib/data/journey";
import { formatDuration } from "@/lib/format";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";

export const dynamic = "force-dynamic";

/**
 * Public personal journey (Step 20, Bible §31).
 *
 * Read-only, and only for the projection — never raw rows. Reachable by
 * logged-out visitors because it is a share artifact.
 *
 * Only PUBLIC/SQUAD-shaped facts appear: counts, patterns, durations. The
 * scratchpad, the notes and the battles themselves are never selected here.
 */
async function load(username: string) {
  return getPublicJourney(username, 30);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const journey = await load(username);
  if (!journey) return { title: `${username} | Mahayuddh`, robots: { index: false } };
  return {
    title: `${journey.username} — last 30 days`,
    description: journey.summary,
    openGraph: { title: `${journey.username}'s last 30 days`, description: journey.summary },
  };
}

export default async function PublicJourneyPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const journey = await load(username);
  if (!journey) notFound();

  const stats: { label: string; value: string }[] = [
    { label: "Battles", value: String(journey.battlesStarted) },
    { label: "Solves", value: String(journey.solved) },
    { label: "Patterns", value: String(journey.patterns) },
    { label: "Approaches", value: String(journey.approachesWritten) },
    { label: "Challenges sent", value: String(journey.challengesSent) },
    { label: "Challenges answered", value: String(journey.challengesAnswered) },
    { label: "Failed then finished", value: String(journey.revengesWon) },
    { label: "Active days", value: String(journey.activeDays) },
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        <header className="space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">
            Last {journey.window.days} days
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            @{journey.username}
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">{journey.summary}</p>
        </header>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <div className="text-2xl font-black font-mono">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </dl>

        {(journey.medianSolveSec != null || journey.revengesWon > 0) && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Detail</h2>
            {journey.medianSolveSec != null && (
              <p className="text-xs text-white/50">
                Median solve {formatDuration(journey.medianSolveSec)}
                {journey.fastestSolveSec != null
                  ? ` · fastest ${formatDuration(journey.fastestSolveSec)}`
                  : ""}
              </p>
            )}
            {journey.revengesWon > 0 && (
              <p className="text-xs text-white/50">
                {journey.revengesWon}{" "}
                {journey.revengesWon === 1 ? "problem was" : "problems were"} failed on and then
                finished.
              </p>
            )}
          </section>
        )}

        {journey.patternsList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Patterns touched</h2>
            <div className="flex flex-wrap gap-1.5">
              {journey.patternsList.map((p) => (
                <Link
                  key={p}
                  href={`/patterns/${encodeURIComponent(p)}`}
                  className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] text-white/60 hover:text-white transition-all"
                >
                  {p}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Counted honestly, including what did not happen. */}
        {journey.challengesSent === 0 && journey.battlesStarted > 0 && (
          <p className="text-xs text-white/30">
            No challenges sent this month — worth checking whether the loop is running for them.
          </p>
        )}

        {/* Reads ?via= so a signup from this journey can be credited to it (§56). */}
        <Suspense fallback={null}>
          <TrackVisit artifact={`journey:${username}`} />
        </Suspense>

        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-lg font-bold">Track your own</h2>
          <p className="text-xs text-white/45">
            Battles, challenges and approaches you log become a shareable record.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/login"
              className="inline-block px-5 py-2.5 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all"
            >
              Start a battle
            </Link>
            <ShareRow
              path={`/u/${username}`}
              artifact={{ kind: "journey", id: username }}
              text={journey.summary}
              label="Share journey"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
