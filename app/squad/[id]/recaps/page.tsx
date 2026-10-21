"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Lock, NotebookPen } from "lucide-react";
import { ShareRow } from "@/components/ui/ShareRow";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { ErrorCard } from "@/components/ui/States";
import { formatDuration } from "@/lib/format";
import { getRecaps, generateRecap, currentWeek } from "@/lib/data/recap";
import { getSquadDetail } from "@/lib/data/squads";
import { dataErrorMessage } from "@/lib/data/errors";
import { recapShareText } from "@/lib/recap";
import { formatRange, isoWeek, serialOf } from "@/components/recap/recapFormat";
import type { SquadRecap } from "@/types/database";

/**
 * Weekly recaps (Step 20, Bible §31/§32).
 *
 * A recap is a frozen projection of one week. The page always says which week
 * it covers, so a shared recap can never be misread as "this is happening
 * now". An empty week gets honest copy and a next action, not zeroes.
 */
export default function SquadRecapsPage() {
  const params = useParams<{ id: string }>();
  const squadId = params.id ?? "";

  const [recaps, setRecaps] = useState<SquadRecap[]>([]);
  const [squadName, setSquadName] = useState("Squad");
  const [squadSince, setSquadSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, detail] = await Promise.all([getRecaps(squadId), getSquadDetail(squadId)]);
      setRecaps(rows);
      setSquadName(detail.squad.name);
      setSquadSince(detail.squad.created_at ?? null);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load recaps. Retry."));
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const body = await generateRecap(squadId, squadName);
      setNotice(
        body.solves === 0
          ? "Generated. It is a quiet week, the recap says so rather than padding."
          : `Generated: ${body.solves} solves.`
      );
      await load();
    } catch (err) {
      setNotice(dataErrorMessage(err, "Couldn't generate a recap. Try again."));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <PageLoader label="Loading recaps..." />;

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={() => void load()} />;
  }

  const week = currentWeek();
  const thisWeek = week.weekStart;
  const [latest, ...archive] = recaps;

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">
        <Link href={`/squad`} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{squadName}</span>
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="type-title text-text-primary md:type-display-md">Weekly recaps</h1>
            <p className="mt-1 text-sm leading-5 text-text-tertiary md:text-[15px] md:leading-6 md:text-text-secondary">
              Frozen every Sunday night. Nothing gets back-filled.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={generate}
            loading={generating}
            className="w-full border border-hairline hover:border-hairline-strong sm:w-auto"
          >
            <NotebookPen className="h-[18px] w-[18px] text-text-secondary" strokeWidth={1.5} aria-hidden />
            {generating ? "Writing this week's recap…" : "Write this week's recap"}
          </Button>
        </header>
      </div>

      {notice && (
        <p role="status" className="card text-sm text-text-secondary">
          {notice}
        </p>
      )}

      {generating && (
        <div role="status" className="card flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong border-t-text-primary"
          />
          <p className="text-[15px] font-medium text-text-primary">Writing this week&apos;s recap…</p>
          <p className="max-w-sm text-xs leading-4 text-text-secondary">
            Reading the squad&apos;s solves, challenges and approaches for{" "}
            <span className="font-mono tnum">{formatRange(week.weekStart, week.weekEnd)}</span>.
          </p>
        </div>
      )}

      {recaps.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface-raised text-text-tertiary">
            <Archive className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </span>
          <h3 className="text-[15px] font-medium text-text-primary">
            Your first recap appears after your squad&apos;s first full week
          </h3>
          <p className="max-w-sm text-[13px] leading-5 text-text-secondary">
            A recap summarises one week of what your squad logged. Generate one above, even a quiet
            week is worth writing down.
          </p>
        </div>
      ) : (
        <>
          {latest && (
            <LatestRecapCard squadId={squadId} squadName={squadName} recap={latest} thisWeek={thisWeek} />
          )}

          <section className="w-full max-w-reading space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">Past recaps</h2>
                <span className="inline-flex h-5 items-center rounded-xs border border-hairline bg-surface-raised px-2 font-mono text-[11px] text-text-secondary tnum">
                  {archive.length} {archive.length === 1 ? "archive" : "archives"}
                </span>
              </div>
              <span className="text-xs text-text-tertiary">Newest first</span>
            </div>

            {archive.length === 0 ? (
              <p className="rounded-md border border-dashed border-hairline-strong px-4 py-5 text-center text-[13px] leading-5 text-text-secondary">
                Earlier weeks land here once a newer recap is written.
              </p>
            ) : (
              <ul className="space-y-2">
                {archive.map((r) => (
                  <li key={r.id}>
                    <ArchiveRow squadId={squadId} recap={r} />
                  </li>
                ))}
              </ul>
            )}

            {/* Only when it reads true: a squad can't have formed after its oldest recap. */}
            {squadSince && squadSince.slice(0, 10) <= recaps[recaps.length - 1].week_start && (
              <p className="flex items-center justify-center gap-2 py-2 text-xs text-text-tertiary">
                <span aria-hidden className="h-px w-8 bg-hairline" />
                Squad formed {monthYear(squadSince)}
                <span aria-hidden className="h-px w-8 bg-hairline" />
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function ArchiveRow({ squadId, recap }: { squadId: string; recap: SquadRecap }) {
  const body = recap.body_json;
  const start = body.window?.weekStart ?? recap.week_start;
  const end = body.window?.weekEnd ?? recap.week_end;
  const week = isoWeek(start);
  const solves = `${body.solves} ${body.solves === 1 ? "solve" : "solves"}`;
  return (
    <Link
      href={`/squad/${squadId}/recaps/${recap.id}`}
      className="group flex min-h-[56px] items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors hover:border-hairline-strong hover:bg-surface-raised md:py-2"
    >
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
        <div className="flex items-center gap-2 md:w-32 md:shrink-0">
          <span className="text-sm font-semibold text-text-primary md:font-mono md:text-[13px] md:font-medium tnum">
            {formatRange(start, end)}
          </span>
          <span className="inline-flex h-5 items-center rounded-xs border border-hairline px-1.5 font-mono text-[11px] text-text-secondary tnum md:hidden">
            {solves}
          </span>
        </div>
        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-hairline md:block" />
        <p className="mt-0.5 truncate text-[13px] leading-5 text-text-secondary transition-colors group-hover:text-text-primary md:mt-0">
          <span className="hidden md:inline">
            <span className="font-mono tnum">{body.solves}</span> {body.solves === 1 ? "solve" : "solves"} ·{" "}
          </span>
          {body.headline}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {week && (
          <span className="hidden font-mono text-[11px] text-text-tertiary tnum sm:block">Week {week.week}</span>
        )}
        <ChevronRight
          className="h-[18px] w-[18px] text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </Link>
  );
}

function LatestRecapCard({
  squadId,
  squadName,
  recap,
  thisWeek,
}: {
  squadId: string;
  squadName: string;
  recap: SquadRecap;
  thisWeek: string;
}) {
  const body = recap.body_json;
  const isThis = recap.week_start === thisWeek;
  const start = body.window?.weekStart ?? recap.week_start;
  const end = body.window?.weekEnd ?? recap.week_end;
  const week = isoWeek(start);
  const improvement = body.biggestImprovement;
  const stats: { label: string; value: number; note?: string | null }[] = [
    { label: "Total solves", value: body.solves },
    { label: "Challenges", value: body.challengesSent, note: `sent / ${body.challengesCompleted} beaten` },
    { label: "Approaches", value: body.approachesWritten, note: "written" },
    {
      label: "Stuck asks",
      value: body.stuckRequests,
      note: body.stuckRequests > 0 ? `${body.stuckHelped} answered` : null,
    },
  ];
  return (
    <section className="space-y-2" aria-label={isThis ? "Current edition" : "Latest edition"}>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
          <span aria-hidden className="h-2 w-2 rounded-full bg-text-tertiary" />
          {isThis ? "Current edition" : "Latest edition"}
        </span>
        {week && (
          <span className="text-xs text-text-tertiary tnum">
            Week {week.week} of {week.year}
          </span>
        )}
      </div>

      <article className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-well px-2.5 text-[13px] font-medium text-text-primary tnum">
              <CalendarDays className="h-[15px] w-[15px] text-text-tertiary" strokeWidth={1.5} aria-hidden />
              {formatRange(start, end, { long: true })}
            </span>
            <span className="inline-flex h-6 items-center gap-1 rounded-xs border border-hairline bg-surface-raised px-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
              <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden />
              Frozen
            </span>
          </div>
          <span className="hidden font-mono text-xs text-text-tertiary tnum sm:inline">
            Serial <span className="text-text-secondary">{serialOf(recap.id)}</span>
          </span>
        </div>

        <h2 className="text-lg font-semibold leading-snug tracking-[-0.01em] text-text-primary md:text-[22px]">
          {body.headline}
        </h2>

        <div className="hidden grid-cols-4 gap-2 sm:grid">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col rounded-md border border-hairline bg-well p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{s.label}</span>
              <span className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-2xl font-semibold leading-8 text-text-primary tnum">{s.value}</span>
                {s.note && <span className="text-[11px] text-text-secondary">{s.note}</span>}
              </span>
            </div>
          ))}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-hairline bg-well p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary tnum sm:hidden">
          <span>
            <span className="text-text-primary">Solves</span> {body.solves}
          </span>
          <span aria-hidden className="text-text-disabled">·</span>
          <span>
            <span className="text-text-primary">Challenges</span> {body.challengesSent} sent, {body.challengesCompleted} beaten
          </span>
          <span aria-hidden className="text-text-disabled">·</span>
          <span>
            <span className="text-text-primary">Approaches</span> {body.approachesWritten}
          </span>
          <span aria-hidden className="text-text-disabled">·</span>
          <span>
            <span className="text-text-primary">Stuck asks</span> {body.stuckRequests}
          </span>
        </p>

        <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/squad/${squadId}/recaps/${recap.id}`}
              className="inline-flex h-10 min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-raised sm:flex-none md:h-9 md:min-h-0"
            >
              Open recap
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Link>
            <ShareRow
              compact
              path={`/squad/${squadId}/recaps/${recap.id}`}
              artifact={{ kind: "recap", id: recap.id, squadId }}
              text={recapShareText({ squadName, body, url: "" }).trim()}
              className="h-10 bg-well px-4 text-sm md:h-9 md:px-3 md:text-[13px]"
            />
          </div>
          {improvement && (
            <p className="flex min-w-0 items-center gap-2 text-xs text-text-tertiary">
              <span className="shrink-0">Biggest improvement:</span>
              <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-xs border border-hairline bg-well px-2 font-mono text-[11px] text-text-primary tnum">
                <span className="truncate">
                  {improvement.username ? `@${improvement.username}` : "A member"} ·{" "}
                  {formatDuration(improvement.fromSec)} → {formatDuration(improvement.toSec)}
                </span>
              </span>
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
