"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartSpline, ChevronRight, Users } from "lucide-react";
import { getMemberWeekGrid, getSquadName, getSquadStreak } from "@/lib/data/squadActivity";
import { getActiveGoalPattern, getSquadMemberIds } from "@/lib/data/squads";
import { getRecaps } from "@/lib/data/recap";

/** Counts for the rail, derived from the squad feed the page already loaded. */
export interface WeekStats {
  solves: number;
  challengesSent: number;
  challengesDone: number;
  approaches: number;
  stuck: number;
}

/**
 * Squad facts the feed rail shows next to the stream. Every field starts (and
 * stays, on a failed read) as null, which the rail renders as "absent" — a
 * rail of zeros on a network hiccup would read as a squad that did nothing.
 */
export interface SquadPulse {
  name: string | null;
  memberCount: number | null;
  /** Oldest → newest, share of members (0–1) who solved that squad-local day. */
  week: number[] | null;
  solvedToday: number | null;
  streakDays: number | null;
  goalPattern: string | null;
  /** undefined while loading; null when the squad has no recap yet. */
  latestRecap: { weekStart: string; weekEnd: string } | null | undefined;
}

const EMPTY: SquadPulse = {
  name: null,
  memberCount: null,
  week: null,
  solvedToday: null,
  streakDays: null,
  goalPattern: null,
  latestRecap: undefined,
};

export function useSquadPulse(squadId: string | null): SquadPulse {
  const [pulse, setPulse] = useState<SquadPulse>(EMPTY);

  useEffect(() => {
    setPulse(EMPTY);
    if (!squadId) return;
    let cancelled = false;
    const patch = (p: Partial<SquadPulse>) => {
      if (!cancelled) setPulse((prev) => ({ ...prev, ...p }));
    };

    getSquadName(squadId).then((name) => patch({ name })).catch(() => {});
    getActiveGoalPattern(squadId).then((goalPattern) => patch({ goalPattern })).catch(() => {});
    getRecaps(squadId, 1)
      .then((rows) =>
        patch({
          latestRecap: rows[0] ? { weekStart: rows[0].week_start, weekEnd: rows[0].week_end } : null,
        })
      )
      .catch(() => {});
    getSquadMemberIds(squadId)
      .then(async (ids) => {
        patch({ memberCount: ids.length });
        if (ids.length === 0) return;
        const [grid, streak] = await Promise.all([
          getMemberWeekGrid(ids, 7).catch(() => null),
          getSquadStreak(ids).catch(() => null),
        ]);
        if (grid) {
          const rows = ids.map((id) => grid[id] ?? []);
          const week = Array.from({ length: 7 }, (_, i) => rows.filter((r) => r[i]).length / ids.length);
          patch({ week, solvedToday: rows.filter((r) => r[6]).length });
        }
        if (streak) patch({ streakDays: streak.days });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [squadId]);

  return pulse;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Copy for the recap link. "Is ready" only when a recap for a recent week exists. */
function recapCopy(r: SquadPulse["latestRecap"]): { title: string; sub: string | null; short: string } {
  if (r === undefined) return { title: "Weekly recaps", sub: null, short: "Recaps" };
  if (r === null) return { title: "Weekly recap", sub: "Not generated yet", short: "Recaps" };
  const ageDays = (Date.now() - new Date(`${r.weekEnd}T00:00:00`).getTime()) / 86_400_000;
  return ageDays <= 10
    ? { title: "Last week's recap is ready", sub: `Week of ${shortDate(r.weekStart)}`, short: "Last week's recap" }
    : { title: "Latest recap", sub: `Week of ${shortDate(r.weekStart)}`, short: "Latest recap" };
}

function squadLabel(name: string | null) {
  return name ?? "your squad";
}

/** Desktop rail (lg and up). */
export function SquadWeekRail({
  squadId,
  pulse,
  stats,
}: {
  squadId: string | null;
  pulse: SquadPulse;
  stats: WeekStats;
}) {
  const recap = recapCopy(pulse.latestRecap);
  const rows: { label: string; value: string; small?: boolean }[] = [
    { label: "Solves", value: String(stats.solves) },
    {
      label: "Challenges",
      value: `${stats.challengesSent} sent, ${stats.challengesDone} done`,
      small: true,
    },
    { label: "Approaches", value: String(stats.approaches) },
    { label: "Stuck asks", value: String(stats.stuck) },
  ];
  const consistency =
    pulse.week && pulse.week.length > 0
      ? Math.round((pulse.week.reduce((a, b) => a + b, 0) / pulse.week.length) * 100)
      : null;
  const members = pulse.memberCount ?? 0;

  return (
    <aside aria-label="Squad weekly summary" className="hidden flex-col gap-4 lg:flex">
      <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold tracking-tight text-text-primary">
            This week in {squadLabel(pulse.name)}
          </h2>
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        </div>
        <dl className="flex flex-col divide-y divide-hairline">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-xs font-medium text-text-secondary">{r.label}</dt>
              <dd
                className={
                  r.small
                    ? "whitespace-nowrap font-mono text-xs font-medium text-text-primary tnum"
                    : "font-mono text-sm font-semibold text-text-primary tnum"
                }
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
        {pulse.week && consistency != null && (
          <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-well p-2.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-medium tracking-[0.06em] text-text-tertiary">
              <span>SQUAD CONSISTENCY</span>
              <span className="text-verified tnum">{consistency}%</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {pulse.week.map((share, i) => {
                const daysAgo = 6 - i;
                const solved = Math.round(share * members);
                return (
                  <div
                    key={i}
                    title={`${daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`}: ${solved} of ${members} solved`}
                    className={share > 0 ? "h-3 rounded-[2px] bg-verified" : "h-3 rounded-[2px] bg-surface-overlay"}
                    style={share > 0 ? { opacity: 0.35 + 0.65 * share } : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {squadId && (
        <Link
          href={`/squad/${squadId}/recaps`}
          className="group flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-raised text-text-secondary transition-colors group-hover:text-text-primary">
              <ChartSpline className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium text-text-primary transition-colors group-hover:text-primary">
                {recap.title}
              </span>
              {recap.sub && <span className="truncate text-[11px] text-text-tertiary">{recap.sub}</span>}
            </span>
          </span>
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
            strokeWidth={1.5}
            aria-hidden
          />
        </Link>
      )}

      {squadId && members > 0 && pulse.solvedToday != null && (
        <section className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text-primary">Today&apos;s focus</span>
            {pulse.streakDays != null && pulse.streakDays > 0 ? (
              <span className="font-mono font-medium tracking-[0.06em] text-primary tnum">
                Day {pulse.streakDays}
              </span>
            ) : (
              <span className="font-mono font-medium tracking-[0.06em] text-text-tertiary">No streak yet</span>
            )}
          </div>
          <p className="text-xs leading-5 text-text-secondary">
            Every member solves one problem today to{" "}
            {pulse.streakDays ? "keep" : "start"} the squad streak.
            {pulse.goalPattern && (
              <>
                {" "}Squad goal: <span className="font-medium text-text-primary">{pulse.goalPattern}</span>.
              </>
            )}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-hairline bg-well">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((pulse.solvedToday / members) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[11px] font-medium tracking-[0.06em] text-text-tertiary tnum">
            <span>
              {pulse.solvedToday} of {members} solved
            </span>
            <span>{Math.round((pulse.solvedToday / members) * 100)}%</span>
          </div>
        </section>
      )}
    </aside>
  );
}

/** Compact summary above the stream below lg (the Stitch mobile banner). */
export function SquadWeekBanner({
  squadId,
  pulse,
  stats,
}: {
  squadId: string | null;
  pulse: SquadPulse;
  stats: WeekStats;
}) {
  const recap = recapCopy(pulse.latestRecap);
  return (
    <section
      aria-label="Squad weekly summary"
      className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-3 lg:hidden"
    >
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
        <h2 className="truncate text-sm font-medium text-text-primary">
          This week in {squadLabel(pulse.name)}
        </h2>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs font-medium tracking-[0.06em] text-text-secondary tnum">
        <span className="text-text-primary">
          {stats.solves} {stats.solves === 1 ? "solve" : "solves"}
        </span>
        <span className="text-text-disabled" aria-hidden>·</span>
        <span>
          {stats.challengesSent} {stats.challengesSent === 1 ? "challenge" : "challenges"}
        </span>
        <span className="text-text-disabled" aria-hidden>·</span>
        <span>
          {stats.approaches} {stats.approaches === 1 ? "approach" : "approaches"}
        </span>
      </p>
      {squadId && (
        <div className="flex justify-end border-t border-hairline pt-1">
          <Link
            href={`/squad/${squadId}/recaps`}
            className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover md:min-h-0 md:py-1"
          >
            {recap.short}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
