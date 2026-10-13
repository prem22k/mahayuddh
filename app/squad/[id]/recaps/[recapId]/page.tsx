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
    { label: "Challenges sent", value: body.challengesSent },
    { label: "Beaten", value: body.challengesCompleted },
    { label: "Approaches", value: body.approachesWritten },
    { label: "Stuck asks", value: body.stuckRequests },
  ];
  const improvement = body.biggestImprovement;

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <div className="mx-auto w-full max-w-reading space-y-8 px-4 py-14">
        <Suspense fallback={null}>
          <TrackVisit artifact={`recap:${recapId}`} />
        </Suspense>

        <header className="space-y-2">
          <p className="text-sm text-text-secondary">
            {squadName} · {body.window?.weekStart ?? recap.week_start}
          </p>
          <h1 className="type-display-md text-text-primary">{body.headline}</h1>
          <p className="font-mono text-xs text-text-tertiary tnum">
            {body.window?.weekStart ?? recap.week_start} →{" "}
            {body.window?.weekEnd ?? recap.week_end}
          </p>
        </header>

        {improvement && (
          <section className="card space-y-2">
            <p className="text-sm text-text-secondary">
              {improvement.username ? `@${improvement.username}` : "Biggest improvement"} ·{" "}
              {titleFromSlug(improvement.slug)}
            </p>
            <p className="type-mono-display text-text-primary">
              <span className="text-text-tertiary line-through">
                {formatDuration(improvement.fromSec)}
              </span>{" "}
              → {formatDuration(improvement.toSec)}
            </p>
          </section>
        )}

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-hairline bg-surface p-3 text-center"
            >
              <div className="font-display text-[28px] font-semibold leading-[31px] text-text-primary tnum">
                {m.value}
              </div>
              <div className="mt-0.5 text-xs text-text-tertiary">{m.label}</div>
            </div>
          ))}
        </dl>

        {body.entries?.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              What happened
            </h2>
            <ul className="space-y-1.5">
              {body.entries.map((e) => (
                <li key={e.label} className="flex items-baseline gap-3 text-sm leading-6">
                  <span className="w-24 shrink-0 text-xs text-text-tertiary">{e.label}</span>
                  <span className="text-text-secondary">{e.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {body.empty?.length > 0 && (
          <section className="space-y-1 border-t border-hairline pt-4">
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              What didn&apos;t happen
            </h2>
            <ul className="space-y-0.5">
              {body.empty.map((line: string) => (
                <li key={line} className="text-sm leading-6 text-text-secondary">
                  · {line}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <ShareRow
            path={path}
            artifact={{ kind: "recap", id: recapId, squadId }}
            text={recapShareText({ squadName, body, url: "" }).trim()}
            label="Share recap"
          />
          <Link
            href="/login"
            className="inline-flex min-h-[44px] h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover md:min-h-0"
          >
            Start your squad
          </Link>
        </div>
        <p className="text-sm leading-6 text-text-secondary">
          Practice with your own people.
        </p>
      </div>
    </div>
  );
}
