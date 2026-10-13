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
    { label: "Beaten", value: result.challengesCompleted },
    { label: "Approaches", value: result.approachesWritten },
    { label: "Active days", value: result.activeDays },
  ];
  const maxSolves = Math.max(1, ...result.members.map((m) => m.solves));

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <div className="mx-auto w-full max-w-reading space-y-8 px-4 py-14">
        <Suspense fallback={null}>
          <TrackVisit artifact={`season:${seasonId}`} />
        </Suspense>

        <header className="space-y-2">
          <h1 className="type-display-md text-text-primary">{result.name}</h1>
          <p className="text-sm leading-6 text-text-secondary">
            {result.squadName} · {result.startsAt}
            {result.endsAt ? ` – ${result.endsAt}` : ""}
          </p>
          {result.objective && (
            <p className="text-sm leading-6 text-text-secondary">
              Objective: {result.objective}
            </p>
          )}
          {result.objectiveProgress && (
            <div
              className="rounded-xl border border-hairline bg-surface p-4"
              role="progressbar"
              aria-valuenow={Math.min(
                100,
                Math.round((result.objectiveProgress.done / result.objectiveProgress.target) * 100)
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Season objective progress: ${result.objectiveProgress.done} of ${result.objectiveProgress.target}`}
            >
              <p className="font-mono text-sm text-text-primary tnum">
                {result.objectiveProgress.done} of {result.objectiveProgress.target}
                {result.objectiveProgress.pattern ? ` ${result.objectiveProgress.pattern} ` : " "}
                solves
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-text-primary transition-all duration-200"
                  style={{
                    width: `${Math.max(
                      2,
                      Math.min(
                        100,
                        Math.round(
                          (result.objectiveProgress.done / result.objectiveProgress.target) * 100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-4 text-text-tertiary">
                {result.objectiveProgress.basis === "parsed"
                  ? "Parsed from the objective text — set a measured target to track this exactly."
                  : result.objectiveProgress.pattern && !result.objectiveProgress.filtered
                    ? "Pattern filter couldn't be measured against the catalog — counting all solves."
                    : result.objectiveProgress.filtered
                      ? `Counted from squad solves in this season${result.objectiveProgress.pattern ? ` matching ${result.objectiveProgress.pattern}` : ""}.`
                      : "Counted from squad solves in this season."}
              </p>
            </div>
          )}
        </header>

        <section className="card space-y-2">
          <p className="type-numeral-xl text-text-primary">
            {result.solves} <span className="text-text-secondary">solves</span>
          </p>
          <p className="text-sm leading-6 text-text-secondary">{result.headline}</p>
        </section>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-hairline bg-surface p-4 text-center">
              <div className="font-display text-[28px] font-semibold leading-[31px] text-text-primary tnum">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-text-tertiary">{s.label}</div>
            </div>
          ))}
        </dl>

        {result.bestImprovement && (
          <section className="card space-y-2">
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              Biggest improvement
            </h2>
            <p className="text-sm text-text-secondary">@{result.bestImprovement.username}</p>
            <p className="text-sm text-text-secondary">
              {result.bestImprovement.slug.replace(/-/g, " ")}
            </p>
            <p className="type-mono-display text-text-primary">
              <span className="text-text-tertiary line-through">
                {formatDuration(result.bestImprovement.fromSec)}
              </span>{" "}
              → {formatDuration(result.bestImprovement.toSec)}
            </p>
          </section>
        )}

        {result.members.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              Who practised
            </h2>
            <ul className="space-y-2">
              {result.members.map((m) => (
                <li key={m.username} className="flex items-center gap-3">
                  <Link
                    href={profileHref(m.username)}
                    className="w-28 shrink-0 truncate text-sm font-medium text-text-primary"
                  >
                    @{m.username}
                  </Link>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-overlay">
                    <span
                      className="block h-full rounded-full bg-text-secondary"
                      style={{ width: `${Math.round((m.solves / maxSolves) * 100)}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-text-secondary tnum">
                    {m.solves}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ShareRow
            path={path}
            artifact={{ kind: "season", id: seasonId, squadId }}
            text={`${result.squadName} — ${result.name}: ${result.headline}`}
            label="Share season"
          />
          <Link
            href="/squad"
            className="inline-flex min-h-[44px] h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
          >
            Back to squad
          </Link>
        </div>
      </div>
    </div>
  );
}
