"use client";

import React from "react";
import { ArrowUpRight, Brain, Check, Share2, Swords, TrendingUp, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { VerifiedBadge, SelfReportedBadge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/format";
import type { Battle } from "@/types/database";

/** `514` -> `"8m 34s"`: improvement deltas read as a span, not a clock. */
export function fmtDelta(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

const secondaryBtn =
  "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay md:h-10 md:px-4";

function PersonalBestPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary-tint px-2.5 py-0.5 text-xs font-semibold leading-4 text-primary",
        className
      )}
    >
      <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      Personal best
    </span>
  );
}

/**
 * The problem page's focal card (Stitch "Latest battle result"). Three honest
 * states: a finished solve (time, delta against your previous best, evidence),
 * a failed attempt (revenge), or nothing yet. Only one gold button per state.
 */
export function LatestResultCard({
  latest,
  bestSec,
  prevSec,
  verified,
  stats,
  copied,
  onStart,
  onExplain,
  onChallenge,
  onCompare,
  onShare,
  onHint,
}: {
  latest: Battle | null;
  bestSec: number | null;
  /** Second-best solved time: the "before" in a personal-best delta. */
  prevSec: number | null;
  verified: boolean;
  /** Quiet counts line; zero items are dropped by the caller. */
  stats: string[];
  copied: boolean;
  onStart: () => void;
  onExplain: () => void;
  onChallenge: () => void;
  onCompare: () => void;
  onShare: () => void;
  onHint: () => void;
}) {
  const finished = latest && (latest.outcome === "solved" || latest.outcome === "failed");
  const solved = finished && latest.outcome === "solved";
  const time = latest ? formatDuration(latest.duration_sec) : null;
  const isBest = Boolean(
    solved && latest.duration_sec != null && bestSec != null && latest.duration_sec === bestSec
  );
  const date = latest
    ? new Date(latest.ended_at ?? latest.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section
      aria-label={finished ? "Latest battle result" : "Start your first battle"}
      className="relative flex flex-col gap-4 overflow-hidden rounded-lg border border-hairline bg-surface p-4 md:p-6"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" aria-hidden />
      <span
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,184,61,0.07),transparent_65%)]"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-3 border-b border-hairline pb-2 md:border-0 md:pb-0">
        <span className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
          {finished && (
            <span
              className={cn("h-1.5 w-1.5 rounded-full md:hidden", solved ? "bg-verified" : "bg-error")}
              aria-hidden
            />
          )}
          {finished ? "Latest battle result" : "No result yet"}
        </span>
        {isBest && <PersonalBestPill className="hidden md:inline-flex" />}
        {finished && date && (
          <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-secondary tnum md:hidden">
            {date}
          </span>
        )}
      </div>

      {solved ? (
        <>
          <div className="relative flex flex-col gap-1.5 pt-1 sm:flex-row sm:items-baseline sm:gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-mono-display text-text-primary">{time ?? "—"}</span>
              {isBest && <PersonalBestPill className="md:hidden" />}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs tnum md:text-sm">
              {isBest && prevSec != null && latest.duration_sec != null ? (
                <>
                  <span className="text-text-tertiary line-through">{formatDuration(prevSec)}</span>
                  <span className="flex items-center gap-1 font-medium text-verified">
                    <TrendingUp className="hidden h-4 w-4 md:block" strokeWidth={1.5} aria-hidden />
                    → {time} · {fmtDelta(prevSec - latest.duration_sec)} faster
                  </span>
                </>
              ) : !isBest && bestSec != null ? (
                <span className="text-text-tertiary">
                  Best <span className="text-text-primary">{formatDuration(bestSec)}</span>
                </span>
              ) : (
                <span className="font-sans text-sm text-text-tertiary">First timed solve</span>
              )}
            </p>
          </div>

          <div className="relative flex items-center gap-2 rounded-md border border-hairline bg-well p-2.5 md:border-0 md:bg-transparent md:p-0 md:pb-1">
            {verified ? <VerifiedBadge className="shrink-0" /> : <SelfReportedBadge className="shrink-0" />}
            <span className="text-xs font-medium leading-4 text-text-secondary md:text-sm md:leading-5">
              {verified ? "Matched an accepted LeetCode submission" : "Logged without a LeetCode match"}
            </span>
          </div>

          {stats.length > 0 && (
            <p className="relative flex flex-wrap gap-x-2 gap-y-1 border-t border-hairline pt-3 text-xs font-medium leading-4 text-text-tertiary">
              {stats.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <span aria-hidden>·</span>}
                  <span>{s}</span>
                </React.Fragment>
              ))}
            </p>
          )}

          <div className="relative flex flex-col gap-2 pt-1 md:flex-row md:flex-wrap md:items-center md:gap-2.5 md:pt-2">
            <Button
              variant="primary"
              onClick={onExplain}
              className="h-11 w-full font-semibold md:h-10 md:w-auto md:px-5"
            >
              <Brain className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              Explain your approach
            </Button>
            <div className="grid grid-cols-2 gap-2 md:contents">
              <button type="button" onClick={onChallenge} className={secondaryBtn}>
                <Swords className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">Challenge someone</span>
              </button>
              <button type="button" onClick={onCompare} className={secondaryBtn}>
                <Users className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate md:hidden">Compare squad</span>
                <span className="hidden truncate md:inline">Compare with squad</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onShare}
              className="flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium leading-4 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:ml-auto md:h-10 md:text-sm md:leading-5"
            >
              {copied ? (
                <Check className="h-4 w-4 text-verified" strokeWidth={1.5} aria-hidden />
              ) : (
                <Share2 className="h-4 w-4 md:hidden" strokeWidth={1.5} aria-hidden />
              )}
              <span>{copied ? "Link copied" : "Share proof"}</span>
              {!copied && (
                <ArrowUpRight className="hidden h-4 w-4 md:block" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </div>
        </>
      ) : finished ? (
        <>
          <div className="relative flex flex-wrap items-baseline gap-3 pt-1">
            <span className="type-mono-display text-text-secondary">{time ?? "—"}</span>
            <span className="inline-flex items-center rounded-full border border-error/30 bg-error-tint px-2 py-0.5 text-xs font-semibold leading-4 text-error">
              Failed
            </span>
          </div>
          <p className="relative text-sm leading-6 text-text-secondary">
            Stopped at <span className="font-mono text-text-primary tnum">{time ?? "—"}</span>
          </p>
          <div className="relative flex flex-col gap-2 md:flex-row md:items-center">
            <Button
              variant="primary"
              onClick={onStart}
              className="h-11 w-full font-semibold md:h-10 md:w-auto md:px-5"
            >
              <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              Take revenge
            </Button>
            <Button variant="ghost" onClick={onHint} className="h-11 w-full md:h-10 md:w-auto">
              Ask for a hint
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="relative text-[15px] leading-6 text-text-secondary">
            Start your first battle to get a time on the board.
          </p>
          <div className="relative">
            <Button
              variant="primary"
              onClick={onStart}
              className="h-11 w-full font-semibold md:h-10 md:w-auto md:px-5"
            >
              <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              Start battle
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
