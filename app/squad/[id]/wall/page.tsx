"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Flame } from "lucide-react";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { VerifiedBadge } from "@/components/ui/Badge";
import { ShareRow } from "@/components/ui/ShareRow";
import { getWall } from "@/lib/data/wall";
import { getRecaps } from "@/lib/data/recap";
import { getSeasons } from "@/lib/data/goals";
import { recapShareText } from "@/lib/recap";
import type { ShareArtifact } from "@/lib/share";
import { dataErrorMessage } from "@/lib/data/errors";
import { relativeDays } from "@/lib/format";
import type { SquadMilestone } from "@/types/database";

/**
 * Squad wall (Step 20, Bible §32).
 *
 * A vertical milestone timeline, not a trophy case. Entries are written by
 * database triggers on the events that earn them, so the wall cannot be edited
 * into looking better than it was.
 */
export default function SquadWallPage() {
  const params = useParams<{ id: string }>();
  const squadId = params.id ?? "";

  const [items, setItems] = useState<SquadMilestone[]>([]);
  const [squadName, setSquadName] = useState("Squad");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Wall-share fix (Wave D): /squad/[id]/wall sits behind auth, so sharing its
  // URL hands a logged-out visitor a login wall. The share targets the latest
  // PUBLIC artifact instead — newest recap first, then newest season — both of
  // which render for strangers. When neither exists yet, there is no ShareRow
  // at all rather than a link that dead-ends at auth.
  const [shareTarget, setShareTarget] = useState<{
    path: string;
    artifact: ShareArtifact;
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { milestones, name } = await getWall(squadId);
      setItems(milestones);
      setSquadName(name);
      const [recaps, seasons] = await Promise.all([
        getRecaps(squadId, 1).catch(() => []),
        getSeasons(squadId).catch(() => []),
      ]);
      const latestRecap = recaps[0] ?? null;
      const latestSeason = seasons[0] ?? null;
      if (latestRecap) {
        setShareTarget({
          path: `/squad/${squadId}/recaps/${latestRecap.id}`,
          artifact: { kind: "recap", id: latestRecap.id, squadId },
          text: recapShareText({ squadName: name, body: latestRecap.body_json, url: "" }).trim(),
        });
      } else if (latestSeason) {
        setShareTarget({
          path: `/squad/${squadId}/seasons/${latestSeason.id}`,
          artifact: { kind: "season", id: latestSeason.id, squadId },
          text: `${name} — ${latestSeason.name}${latestSeason.objective ? `: ${latestSeason.objective}` : ""}`,
        });
      } else {
        setShareTarget(null);
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load the wall. Retry."));
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byMonth = new Map<string, SquadMilestone[]>();
    for (const m of items.slice(1)) {
      const d = new Date(m.occurred_at);
      const key = Number.isNaN(d.getTime())
        ? "Undated"
        : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const list = byMonth.get(key) ?? [];
      list.push(m);
      byMonth.set(key, list);
    }
    return [...byMonth.entries()];
  }, [items]);

  const [latest, ...rest] = items;
  void rest;

  if (loading)
    return (
      <div className="mx-auto w-full max-w-reading space-y-3" aria-label="Loading the wall">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={() => void load()} />;
  }

  return (
    <div className="mx-auto w-full max-w-reading space-y-8">
      <Link
        href="/squad"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>{squadName}</span>
      </Link>

      <header>
        <h1 className="type-display-md text-text-primary">{squadName}&rsquo;s wall</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Every milestone here happened. Verified ones are marked.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          heading="Nothing on the wall yet"
          body="Milestones show up here as your squad hits them, like a first hard solve, a 7-day squad streak, or a finished goal."
          action={
            <Link
              href="/squad"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
            >
              Set a squad goal
            </Link>
          }
        />
      ) : (
        <>
          {latest && (
            <article className="card">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <Flame className="h-5 w-5" strokeWidth={1.5} fill="currentColor" />
                </span>
                {shareTarget && (
                  <ShareRow
                    path={shareTarget.path}
                    artifact={shareTarget.artifact}
                    text={`${squadName}: ${latest.title}`}
                    label="Share"
                  />
                )}
              </div>
              <h2 className="type-title mt-3 text-text-primary">{latest.title}</h2>
              {latest.detail && (
                <p className="mt-1 text-sm leading-6 text-text-secondary">{latest.detail}</p>
              )}
              <p className="mt-2 font-mono text-xs text-text-tertiary tnum">
                {relativeDays(daysBetweenFor(latest.occurred_at))}
              </p>
            </article>
          )}

          <ol className="relative space-y-8 border-l border-hairline pl-6">
            {groups.map(([month, ms]) => (
              <li key={month} className="space-y-3">
                <h2 className="text-lg font-semibold leading-[26px] text-text-primary">{month}</h2>
                <ol className="space-y-3">
                  {ms.map((m) => (
                    <li key={m.id} className="relative rounded-xl border border-hairline bg-surface p-4">
                      <span
                        aria-hidden
                        className="absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full bg-surface-overlay ring-2 ring-canvas"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{m.title}</p>
                        {isVerified(m) && <VerifiedBadge />}
                      </div>
                      {m.detail && (
                        <p className="mt-0.5 text-sm leading-6 text-text-secondary">{m.detail}</p>
                      )}
                      <p className="mt-1 font-mono text-xs text-text-tertiary tnum">
                        {relativeDays(daysBetweenFor(m.occurred_at))}
                      </p>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function isVerified(m: SquadMilestone): boolean {
  const hay = `${m.title} ${m.detail ?? ""}`.toLowerCase();
  return hay.includes("verified");
}

function daysBetweenFor(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}
