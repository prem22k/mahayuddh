"use client";

import React from "react";
import { getRecommendationStats } from "@/lib/data/recommend";
import { label, type SignalBreakdown } from "@/lib/recommendationLog";
import { dataErrorMessage } from "@/lib/data/errors";
import { useCachedQuery } from "@/lib/cache/query";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";

/**
 * "Is this helping you?" (§24).
 *
 * The recommendation weights are a guess, and the plan says they get validated
 * before any AI is involved. This is the read side of that: the accept rate of
 * the reasons we gave, from the log.
 *
 * It is deliberately unflattering. With fewer than five presentations it says
 * so rather than reporting "prereq_ready: 100%". "Plateau — 0 of 4" next to
 * "Prerequisites met — 11 of 12" is more useful to whoever is tuning the
 * weights than a single flattering percentage would be.
 */
// One fresh [] per render would break every memo downstream.
const NO_SIGNALS: SignalBreakdown[] = [];

export function RecommendationStats() {
  // The log the engine's presentations accumulate; a fresh decision changes
  // it, so refresh often rather than holding it long.
  const statsQ = useCachedQuery(["recommendation-stats"], () => getRecommendationStats(), {
    freshForMs: 10_000,
  });
  const overall = statsQ.data?.overall ?? null;
  const signals = statsQ.data?.perSignal ?? NO_SIGNALS;
  const summary = statsQ.data?.summary ?? "";

  if (statsQ.isLoading) {
    return (
      <div className="flex flex-col gap-1.5" aria-label="Loading recommendation log">
        <Skeleton className="h-3 w-3/4 rounded-xs" />
        <Skeleton className="h-3 w-1/2 rounded-xs" />
      </div>
    );
  }

  // An error with cached data stays quiet and keeps the numbers on screen.
  if (statsQ.error && !statsQ.data) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-text-secondary">
          {dataErrorMessage(statsQ.error, "Couldn't read your history here.")}
        </p>
        <Button
          variant="secondary"
          className="shrink-0 border border-hairline"
          onClick={() => void statsQ.refresh()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-text-secondary">{summary}</p>

      {overall && signals.length > 0 && (
        <ul className="space-y-1.5">
          {signals.map((s) => (
            <li key={s.signal} className="flex items-center gap-3 text-xs leading-5">
              <span className="w-32 shrink-0 truncate text-text-secondary">{label(s.signal)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-hairline bg-well">
                {/* Width is the measured rate, never a rounded-up vibe. With
                    fewer than five presentations the bar is left empty and the
                    count says why. */}
                <div
                  className="h-full rounded-full bg-text-tertiary/60"
                  style={{ width: `${(s.rate ?? 0) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-text-tertiary tnum">
                {s.accepted}/{s.presented}
              </span>
            </li>
          ))}
        </ul>
      )}

      {overall && (
        <p className="text-xs leading-4 text-text-tertiary">
          A recommendation can carry several reasons, so each is credited with all of them.
          Numbers under five presentations are not yet evidence of anything.
        </p>
      )}
    </div>
  );
}