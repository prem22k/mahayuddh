import { profileHref } from "@/lib/profiles/username";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeasonResult } from "@/lib/data/seasonResult";
import { formatDuration } from "@/lib/format";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";

export const dynamic = "force-dynamic";

/**
 * Public season result (§38).
 *
 * The fifth artifact Step 20 asked for and the only one never built. A season is
 * the one thing a squad finishes together, so it is the artifact whose whole
 * point is the group — and a completed season previously had nothing to share.
 *
 * The headline is generated the same way the recap's is: it states what
 * happened, including when a challenge loop never ran.
 */
async function load(squadId: string, seasonId: string) {
  return getSeasonResult(squadId, seasonId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}): Promise<Metadata> {
  const { id, seasonId } = await params;
  const result = await load(id, seasonId);
  if (!result) return { robots: { index: false } };
  return {
    title: `${result.squadName} — ${result.name}`,
    description: result.headline,
    openGraph: {
      title: `${result.squadName} — ${result.name}`,
      description: result.headline,
    },
  };
}

export default async function SeasonResultPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id: squadId, seasonId } = await params;
  const result = await load(squadId, seasonId);
  if (!result) notFound();

  const path = `/squad/${squadId}/seasons/${seasonId}`;

  const stats = [
    { label: "Solves", value: result.solves },
    { label: "Problems", value: result.problems },
    { label: "Challenges", value: result.challengesSent },
    { label: "Answered", value: result.challengesCompleted },
    { label: "Approaches", value: result.approachesWritten },
    { label: "Active days", value: result.activeDays },
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        <Suspense fallback={null}>
          <TrackVisit artifact={`season:${seasonId}`} />
        </Suspense>

        <header className="space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/55">
            {result.startsAt}
            {result.endsAt ? ` → ${result.endsAt}` : ""}
            {result.status === "complete" ? " · complete" : ""}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {result.squadName}
          </h1>
          <p className="text-sm text-white/60">{result.name}</p>
          {result.objective && <p className="text-xs text-white/55">{result.objective}</p>}
          <p className="text-sm text-white/50 leading-relaxed">{result.headline}</p>
        </header>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <div className="text-2xl font-black font-mono">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </dl>

        {result.bestImprovement && (
          <section className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              Biggest improvement
            </div>
            <p className="text-sm text-white/80">
              {result.bestImprovement.slug.replace(/-/g, " ")}{" "}
              {formatDuration(result.bestImprovement.fromSec)} →{" "}
              {formatDuration(result.bestImprovement.toSec)}
            </p>
            <p className="text-[11px] text-white/50">@{result.bestImprovement.username}</p>
          </section>
        )}

        {result.members.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Who practised</h2>
            <ul className="space-y-1">
              {result.members.map((m) => (
                <li key={m.username} className="flex items-center justify-between gap-3 text-xs">
                  <Link href={profileHref(m.username)} className="font-bold text-white/80 hover:text-white">
                    @{m.username}
                  </Link>
                  <span className="font-mono text-white/50">{m.solves}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <ShareRow
            path={path}
            artifact={{ kind: "season", id: seasonId, squadId }}
            text={`${result.squadName} — ${result.name}: ${result.headline}`}
            label="Share season"
          />
          <Link
            href="/login"
            className="px-4 py-2 rounded-full btn-accent text-white text-[11px] font-bold"
          >
            Track your own
          </Link>
        </div>
      </div>
    </div>
  );
}
