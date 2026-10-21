import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Activity, ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { safeNext } from "@/lib/safeNext";
import { getPublicRecap } from "@/lib/data/recapPublic";
import { recapShareText } from "@/lib/recap";
import { ShareRow } from "@/components/ui/ShareRow";
import { PostKit } from "@/components/ui/PostKit";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { ArtifactFrame, MemberOnly, VisitorCta } from "@/components/recap/ArtifactChrome";
import {
  DidNotHappenList,
  HappenedList,
  ImprovementPass,
  RecapNumbers,
  SectionLabel,
} from "@/components/recap/RecapBlocks";
import { formatDay, formatRange, isoWeek, serialOf } from "@/components/recap/recapFormat";

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
  // Deep-continue (Wave D): the visitor CTA carries ?next=<artifact> through
  // safeNext so auth lands back on this recap. Login already honors ?next=.
  const nextParam = encodeURIComponent(safeNext(path) ?? "/home");
  const shareText = recapShareText({ squadName, body, url: "" }).trim();
  const artifact = { kind: "recap" as const, id: recapId, squadId };

  // Everything below is read off the stored row: the window, the freeze date
  // and the identifiers. Week number and serial are labels, not measurements.
  const weekStart = body.window?.weekStart ?? recap.week_start;
  const weekEnd = body.window?.weekEnd ?? recap.week_end;
  const week = isoWeek(weekStart);
  const serial = serialOf(recap.id);
  const frozenOn = formatDay(body.generatedAt ?? recap.created_at, { year: true });
  const improvement = body.biggestImprovement;

  return (
    <ArtifactFrame
      crumb={`Recap · ${formatRange(weekStart, weekEnd)}`}
      signInHref={`/login?next=${nextParam}`}
      className="max-w-reading space-y-10"
    >
      <Suspense fallback={null}>
        <TrackVisit artifact={`recap:${recapId}`} />
      </Suspense>

      <header className="space-y-3">
        <MemberOnly>
          <Link
            href={`/squad/${squadId}/recaps`}
            className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Weekly recaps
          </Link>
        </MemberOnly>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium text-text-primary">{squadName}</span>
            <span aria-hidden className="text-text-tertiary">
              ·
            </span>
            <span className="font-mono text-xs text-text-tertiary tnum">
              {formatRange(weekStart, weekEnd, { long: true, year: true })}
            </span>
          </p>
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs border border-hairline bg-surface-raised px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary tnum">
            <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            Frozen{week ? ` · W${week.week}` : ""}
          </span>
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary md:text-[40px]">
          {body.headline}
        </h1>
        <p className="text-[15px] leading-6 text-text-secondary md:text-base md:leading-7">
          Frozen {frozenOn}. Nothing gets back-filled: these are the numbers the squad saw when
          the week closed.
        </p>
      </header>

      {improvement && (
        <section className="space-y-2">
          <SectionLabel>Week&apos;s biggest improvement</SectionLabel>
          <ImprovementPass
            username={improvement.username}
            slug={improvement.slug}
            fromSec={improvement.fromSec}
            toSec={improvement.toSec}
            fields={[
              { label: "Serial", value: serial },
              { label: "Squad", value: squadName },
              { label: "Week", value: week ? `W${week.week} · ${week.year}` : weekStart },
              { label: "Frozen", value: frozenOn },
            ]}
          />
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel>The week in numbers</SectionLabel>
        <RecapNumbers body={body} />
      </section>

      {body.entries?.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
            <Activity className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
            What happened
          </h2>
          <HappenedList entries={body.entries} />
        </section>
      )}

      {body.empty?.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
            <ShieldAlert className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
            What didn&apos;t happen
          </h2>
          <DidNotHappenList lines={body.empty} />
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel>Share this recap</SectionLabel>
        <div className="space-y-4 rounded-xl border border-hairline bg-surface p-4 md:p-5">
          <ShareRow expanded path={path} artifact={artifact} text={shareText} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <PostKit
                imageHref={`${path}/opengraph-image`}
                path={path}
                artifact={artifact}
                text={shareText}
              />
              {/* The phone share sheet, where there is one. */}
              <div className="md:hidden">
                <ShareRow compact path={path} artifact={artifact} text={shareText} label="Share recap" />
              </div>
            </div>
            <span className="hidden font-mono text-xs text-text-tertiary tnum md:inline">Serial {serial}</span>
          </div>
        </div>
      </section>

      <VisitorCta
        href={`/login?mode=signup&next=${nextParam}`}
        body="Timed solves, verified proof, and a weekly recap like this one, for your own squad."
      />

      <footer className="space-y-1.5 border-t border-hairline pt-6 text-center">
        <p className="text-xs text-text-tertiary">Mahayuddh · Practice DSA with your people</p>
        <p className="font-mono text-[11px] text-text-tertiary tnum">
          Frozen record {serial} · {frozenOn}
        </p>
      </footer>
    </ArtifactFrame>
  );
}
