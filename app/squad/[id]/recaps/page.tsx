"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ShareRow } from "@/components/ui/ShareRow";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { getRecaps, generateRecap, currentWeek } from "@/lib/data/recap";
import { getSquadDetail } from "@/lib/data/squads";
import { dataErrorMessage } from "@/lib/data/errors";
import { recapShareText } from "@/lib/recap";
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

  const thisWeek = currentWeek().weekStart;
  const [latest, ...archive] = recaps;

  return (
    <div className="mx-auto w-full max-w-reading space-y-8">
      <Link href={`/squad`} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>{squadName}</span>
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-display-md text-text-primary">Weekly recaps</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Frozen every Sunday night. Nothing gets back-filled.
          </p>
        </div>
        <Button variant="secondary" onClick={generate} loading={generating}>
          {generating ? "Writing this week's recap…" : "Write this week's recap"}
        </Button>
      </header>

      {notice && (
        <p role="status" className="card text-sm text-text-secondary">
          {notice}
        </p>
      )}

      {recaps.length === 0 ? (
        <EmptyState
          heading="Your first recap appears after your squad's first full week"
          body="A recap summarises one week of what your squad logged. Generate one above, even a quiet week is worth writing down."
        />
      ) : (
        <div className="space-y-3">
          {latest && (
            <LatestRecapCard squadId={squadId} squadName={squadName} recap={latest} thisWeek={thisWeek} />
          )}

          {archive.map((r) => {
            const body = r.body_json;
            return (
              <Link
                key={r.id}
                href={`/squad/${squadId}/recaps/${r.id}`}
                className="card-interactive flex min-h-[56px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {body.window?.weekStart ?? r.week_start}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-text-tertiary tnum">
                    {body.solves} solves · {body.headline}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
  return (
    <article className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-text-tertiary tnum">
            {body.window?.weekStart ?? recap.week_start}
            {isThis ? " · current week" : ""}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-[26px] text-text-primary">
            {body.headline}
          </h2>
        </div>
        <ShareRow
          path={`/squad/${squadId}/recaps/${recap.id}`}
          artifact={{ kind: "recap", id: recap.id, squadId }}
          text={recapShareText({ squadName, body, url: "" }).trim()}
        />
      </div>

      <p className="font-mono text-xs text-text-tertiary tnum">
        Solves {body.solves} · Challenges {body.challengesSent} sent, {body.challengesCompleted} beaten · Approaches {body.approachesWritten} · Stuck asks {body.stuckRequests}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/squad/${squadId}/recaps/${recap.id}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
        >
          Open recap
        </Link>
      </div>
    </article>
  );
}
