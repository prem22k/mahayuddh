"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorCard, Skeleton } from "@/components/ui/States";
import { VerifiedBadge } from "@/components/ui/Badge";
import { ShareRow } from "@/components/ui/ShareRow";
import { getWall } from "@/lib/data/wall";
import { getRecaps } from "@/lib/data/recap";
import { getSeasons } from "@/lib/data/goals";
import { recapShareText } from "@/lib/recap";
import type { ShareArtifact } from "@/lib/share";
import { dataErrorMessage } from "@/lib/data/errors";
import { relativeDays } from "@/lib/format";
import type { MilestoneKind, SquadMilestone } from "@/types/database";

/** getWall's default cap, so the count can say "50+" honestly. */
const WALL_LIMIT = 50;

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
      const { milestones, name } = await getWall(squadId, WALL_LIMIT);
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
    const thisYear = new Date().getFullYear();
    for (const m of items.slice(1)) {
      const d = new Date(m.occurred_at);
      // The year only shows when it isn't this one ("October", "October 2025").
      const key = Number.isNaN(d.getTime())
        ? "Undated"
        : d.toLocaleDateString("en-GB", {
            month: "long",
            ...(d.getFullYear() === thisYear ? {} : { year: "numeric" }),
          });
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
      <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-10" aria-label="Loading the wall">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={() => void load()} />;
  }

  // getWall caps the query; at the cap there may be more than we can count.
  const countLabel = `${items.length}${items.length >= WALL_LIMIT ? "+" : ""} ${items.length === 1 ? "milestone" : "milestones"}`;

  return (
    <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-10">
      <div className="space-y-2 md:space-y-3">
        <Link
          href="/squad"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{squadName}</span>
        </Link>

        <header className="flex flex-col gap-1 md:gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
              {squadName}&rsquo;s wall
            </h1>
            {items.length > 0 && (
              <span className="shrink-0 rounded-xs border border-hairline bg-surface px-2 py-0.5 font-mono text-[11px] text-text-tertiary tnum md:px-2.5 md:py-1 md:text-xs">
                {countLabel}
              </span>
            )}
          </div>
          <p className="text-xs leading-5 text-text-secondary md:text-sm">
            Every milestone here happened. Verified ones are marked.
          </p>
        </header>
      </div>

      {items.length === 0 ? (
        <section className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 md:p-6">
          <div className="flex flex-col gap-4 md:gap-5">
            <span className="self-start rounded-xs border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-tertiary md:text-[11px]">
              No milestones yet
            </span>
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-raised text-text-tertiary md:h-12 md:w-12 md:rounded-lg">
                <Flame className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1 md:gap-1.5">
                <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary md:text-2xl">
                  Nothing on the wall yet
                </h2>
                <p className="text-xs leading-relaxed text-text-secondary md:text-sm">
                  Milestones show up here as your squad hits them, like a first hard solve, a 7-day squad streak, or a
                  finished goal.
                </p>
              </div>
            </div>
            <div className="border-t border-hairline pt-3 md:pt-4">
              <Link
                href="/squad"
                className="inline-flex h-9 min-h-[44px] items-center justify-center rounded-sm border border-hairline bg-surface-raised px-4 text-xs font-medium text-text-primary transition-colors hover:bg-surface-overlay md:min-h-0"
              >
                Set a squad goal
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          {latest && (
            <article className="group relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 shadow-sm transition-colors hover:border-hairline-strong md:p-6">
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-edge-highlight" />
              <div className="flex flex-col gap-4 md:gap-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-xs border border-primary/25 bg-primary-tint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary md:text-[11px]">
                      Latest milestone
                    </span>
                    <span className="hidden text-xs text-text-tertiary md:inline" aria-hidden>
                      ·
                    </span>
                    <time
                      dateTime={latest.occurred_at}
                      className="hidden font-mono text-xs text-text-tertiary tnum md:inline"
                    >
                      {formatLongDay(latest.occurred_at)}
                    </time>
                  </div>
                  {shareTarget && (
                    <ShareRow
                      compact
                      path={shareTarget.path}
                      artifact={shareTarget.artifact}
                      text={`${squadName}: ${latest.title}`}
                      label="Share"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-tint text-primary md:h-12 md:w-12 md:rounded-lg">
                    <Flame className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} fill="currentColor" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 md:gap-1.5">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary md:text-2xl">
                      {latest.title}
                    </h2>
                    <time dateTime={latest.occurred_at} className="font-mono text-[11px] text-text-tertiary tnum md:hidden">
                      {formatLongDay(latest.occurred_at)}
                    </time>
                    {latest.detail && (
                      <p className="pt-1 text-xs leading-relaxed text-text-secondary md:pt-0 md:text-sm">
                        {latest.detail}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5 text-[11px] text-text-tertiary md:pt-4 md:text-xs">
                  <span className="text-text-secondary">{KIND_LABEL[latest.kind] ?? "Milestone"}</span>
                  <span className="flex items-center gap-3">
                    {isVerified(latest) && (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-verified">
                        <span aria-hidden className="h-2 w-2 rounded-full bg-verified" />
                        Verified
                      </span>
                    )}
                    <span className="font-mono text-[11px] tnum">
                      {relativeDays(daysBetweenFor(latest.occurred_at))}
                    </span>
                  </span>
                </div>
              </div>
            </article>
          )}

          {groups.length > 0 && (
            <section className="flex flex-col gap-6 md:gap-10" aria-label="Earlier milestones">
              {groups.map(([month, ms]) => (
                <div key={month} className="flex flex-col gap-3 md:gap-6">
                  <div className="flex items-center gap-2 md:gap-3">
                    <h2 className="font-display text-sm font-semibold tracking-tight text-text-primary md:text-lg">
                      {month}
                    </h2>
                    <div aria-hidden className="h-px flex-1 bg-hairline" />
                    <span className="font-mono text-[10px] text-text-tertiary tnum md:text-xs">
                      {ms.length} {ms.length === 1 ? "milestone" : "milestones"}
                    </span>
                  </div>
                  <ol className="relative ml-1.5 flex flex-col gap-3.5 border-l border-hairline pl-4 md:ml-2 md:gap-6 md:pl-6">
                    {ms.map((m) => {
                      const verified = isVerified(m);
                      return (
                        <li key={m.id} className="group relative">
                          <span
                            aria-hidden
                            className={cn(
                              "absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border md:-left-[31px] md:h-2.5 md:w-2.5",
                              verified
                                ? "border-verified/50 bg-verified-tint"
                                : "border-hairline bg-surface-raised transition-colors group-hover:border-primary"
                            )}
                          />
                          <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-surface p-3 transition-colors hover:bg-surface-raised md:gap-2 md:rounded-lg md:p-4">
                            <div className="flex items-start justify-between gap-2 md:gap-4">
                              <div className="flex min-w-0 flex-col gap-0.5 md:gap-1">
                                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                  <p className="text-[13px] font-semibold text-text-primary md:text-sm">{m.title}</p>
                                  {verified && <VerifiedBadge className="h-5 px-1.5 text-[10px] md:h-6 md:text-[11px]" />}
                                </div>
                                {m.detail && (
                                  <p className="text-[11px] leading-5 text-text-secondary md:text-xs">{m.detail}</p>
                                )}
                              </div>
                              <time
                                dateTime={m.occurred_at}
                                title={relativeDays(daysBetweenFor(m.occurred_at))}
                                className="shrink-0 font-mono text-[10px] text-text-tertiary tnum md:text-xs"
                              >
                                {formatShortDay(m.occurred_at)}
                              </time>
                            </div>
                            <div className="hidden items-center gap-2 border-t border-hairline pt-2 md:flex">
                              <span className="rounded-xs bg-pattern-tint px-2 py-0.5 text-[11px] font-medium text-pattern">
                                {KIND_LABEL[m.kind] ?? "Milestone"}
                              </span>
                              <span className="font-mono text-[11px] text-text-tertiary tnum">
                                {relativeDays(daysBetweenFor(m.occurred_at))}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </section>
          )}

          <section className="hidden items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-6 md:flex">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-text-primary">Want to put the next moment on the wall?</span>
              <span className="text-xs text-text-secondary">
                Set a new squad goal or sweep a pattern roadmap together.
              </span>
            </div>
            <Link
              href="/squad"
              className="inline-flex h-9 shrink-0 items-center rounded-sm border border-hairline bg-surface-raised px-4 text-xs font-medium text-text-primary transition-colors hover:bg-surface-overlay"
            >
              Set a squad goal
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

/** Wall chips per trigger kind; the kinds are written by the database. */
const KIND_LABEL: Partial<Record<MilestoneKind, string>> = {
  first_member: "Roster",
  first_challenge: "Challenge",
  first_solve: "First solve",
  milestone_solves: "Solve milestone",
  milestone_solves_100: "Solve milestone",
  milestone_challenges: "Challenge milestone",
  season_complete: "Squad season",
  goal_complete: "Squad goal",
};

/** Three-letter months, so September reads "Sep" (en-GB ICU says "Sept"). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sun 11 Oct" */
function formatLongDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "11 Oct" */
function formatShortDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function isVerified(m: SquadMilestone): boolean {
  const hay = `${m.title} ${m.detail ?? ""}`.toLowerCase();
  return hay.includes("verified");
}

function daysBetweenFor(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}
