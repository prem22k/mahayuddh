"use client";

import React, { useEffect, useState } from "react";
import { getRecommendationStats } from "@/lib/data/recommend";
import { label, type AcceptRate, type SignalBreakdown } from "@/lib/recommendationLog";
import { dataErrorMessage } from "@/lib/data/errors";

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
export function RecommendationStats() {
  const [overall, setOverall] = useState<AcceptRate | null>(null);
  const [signals, setSignals] = useState<SignalBreakdown[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecommendationStats()
      .then((s) => {
        setOverall(s.overall);
        setSignals(s.perSignal);
        setSummary(s.summary);
      })
      .catch((err) => setError(dataErrorMessage(err, "Couldn't read your history here.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-[11px] text-white/25">Reading your recommendation log…</p>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/30">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 rounded-full bg-white/[0.06] text-[11px] font-bold text-white/60 hover:text-white cursor-pointer shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/40">{summary}</p>

      {overall && signals.length > 0 && (
        <ul className="space-y-1">
          {signals.map((s) => (
            <li key={s.signal} className="flex items-center gap-2 text-[11px]">
              <span className="text-white/50 w-32 shrink-0 truncate">{label(s.signal)}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                {/* Width is the measured rate, never a rounded-up vibe. With
                    fewer than five presentations the bar is left empty and the
                    count says why. */}
                <div
                  className="h-full rounded-full bg-white/30"
                  style={{ width: `${(s.rate ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-white/35 font-mono w-16 text-right shrink-0">
                {s.accepted}/{s.presented}
              </span>
            </li>
          ))}
        </ul>
      )}

      {overall && (
        <p className="text-[10px] text-white/20">
          A recommendation can carry several reasons, so each is credited with all of them.
          Numbers under five presentations are not yet evidence of anything.
        </p>
      )}
    </div>
  );
}