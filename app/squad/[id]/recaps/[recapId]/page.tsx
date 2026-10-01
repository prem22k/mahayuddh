import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicRecap } from "@/lib/data/recapPublic";
import { formatDuration, titleFromSlug } from "@/lib/format";
import { recapShareText } from "@/lib/recap";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";

export const dynamic = "force-dynamic";

/**
 * One frozen weekly recap, public (Step 20, Bible §31/§32).
 *
 * The list at /squad/[id]/recaps is behind auth; this is the shareable copy.
 * It reads the stored projection only, so the numbers a squad saw when the
 * week closed are the numbers a visitor sees forever after — a recap that
 * silently re-derives itself would change its story every time somebody
 * deleted a battle.
 */
async function load(squadId: string, recapId: string) {
  return getPublicRecap(squadId, recapId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; recapId: string }>;
}): Promise<Metadata> {
  const { id, recapId } = await params;
  const found = await load(id, recapId);
  if (!found) return { robots: { index: false } };
  const body = found.recap.body_json;
  return {
    title: `${found.squadName} — week of ${body.window.weekStart}`,
    description: body.headline,
    openGraph: {
      title: `${found.squadName} — week of ${body.window.weekStart}`,
      description: body.headline,
    },
  };
}

export default async function PublicRecapPage({
  params,
}: {
  params: Promise<{ id: string; recapId: string }>;
}) {
  const { id: squadId, recapId } = await params;
  const found = await load(squadId, recapId);
  if (!found) notFound();
  const { recap, squadName } = found;
  const body = recap.body_json;

  const path = `/squad/${squadId}/recaps/${recapId}`;
  const metrics = [
    { label: "Solves", value: body.solves },
    { label: "Challenges", value: body.challengesSent },
    { label: "Answered", value: body.challengesCompleted },
    { label: "Approaches", value: body.approachesWritten },
    { label: "Stuck asks", value: body.stuckRequests },
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        <Suspense fallback={null}>
          <TrackVisit artifact={`recap:${recapId}`} />
        </Suspense>

        <header className="space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">
            Week of {body.window?.weekStart ?? recap.week_start}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{squadName}</h1>
          <p className="text-sm text-white/60 leading-relaxed">{body.headline}</p>
          {/* The week is named in the page itself, not only in the metadata, so a
              reader six weeks later cannot mistake this for the current week. */}
          <p className="text-[10px] text-white/25 font-mono">
            {body.window?.weekStart ?? recap.week_start} →{" "}
            {body.window?.weekEnd ?? recap.week_end}
          </p>
        </header>

        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center"
            >
              <div className="text-xl font-black text-white font-mono">{m.value}</div>
              <div className="text-[10px] text-white/35 mt-0.5">{m.label}</div>
            </div>
          ))}
        </dl>

        {body.biggestImprovement && (
          <section className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">
              Biggest improvement
            </div>
            <p className="text-sm text-white/80">
              {titleFromSlug(body.biggestImprovement.slug)}{" "}
              {formatDuration(body.biggestImprovement.fromSec)} →{" "}
              {formatDuration(body.biggestImprovement.toSec)}
            </p>
            {body.biggestImprovement.username && (
              <p className="text-[11px] text-white/35">
                @{body.biggestImprovement.username}
              </p>
            )}
          </section>
        )}

        {body.entries?.length > 0 && (
          <ul className="space-y-1.5">
            {body.entries.map((e) => (
              <li key={e.label} className="flex items-baseline gap-2 text-sm text-white/60">
                <span className="text-white/30 text-[10px] uppercase tracking-wider w-24 shrink-0">
                  {e.label}
                </span>
                {e.detail}
              </li>
            ))}
          </ul>
        )}

        {/* The empty sections are the point. A recap that only listed wins would
            be a highlight reel, and the plan asks for the opposite. */}
        {body.empty?.length > 0 && (
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">
              Did not happen
            </div>
            <ul className="space-y-0.5">
              {body.empty.map((line: string) => (
                <li key={line} className="text-[11px] text-white/30">
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-2">
          <ShareRow
            path={path}
            artifact={{ kind: "recap", id: recapId, squadId }}
            text={recapShareText({ squadName, body, url: "" }).trim()}
            label="Share recap"
          />
          <Link
            href="/login"
            className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-[11px] font-bold transition-all"
          >
            Track your own
          </Link>
        </div>
      </div>
    </div>
  );
}
