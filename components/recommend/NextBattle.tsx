"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Play, Sparkles, X } from "lucide-react";
import { useSolving } from "@/components/providers/SolvingProvider";
import {
  getRecommendation,
  logRecommendationDecision,
  logRecommendationShown,
  type RecSurface,
} from "@/lib/data/recommend";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import type { Recommendation } from "@/lib/recommend";
import { RecommendationStats } from "./RecommendationStats";

/**
 * "Next battle" (Step 24, Bible §24).
 *
 * Shows the engine's reasons verbatim and lets the person dismiss it. Two
 * reasons for that shape:
 *
 *  - §24's done criterion is "4/5 recommendations have ≥2 truthful
 *    why-bullets". Truthful bullets only matter if the reader can see them.
 *  - The weights are a guess. Showing them, and logging what happens, is how
 *    the guess gets corrected instead of argued about.
 *
 * When the engine has nothing to say it says that. A card that always shows
 * something would push us to invent reasons.
 */
export function NextBattle({
  surface,
  goalPattern = null,
  className = "",
}: {
  surface: RecSurface;
  goalPattern?: string | null;
  className?: string;
}) {
  const { startSolving } = useSolving();
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getRecommendation({ goalPattern });
      setRec(r);
      // Logged after it renders, and never awaited: logging is best-effort and
      // must not delay or fail the surface.
      if (r) void logRecommendationShown(r, surface).catch(() => {});
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't build a recommendation."));
    } finally {
      setLoading(false);
    }
  }, [surface, goalPattern]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: "accepted" | "dismissed") => {
    if (!rec) return;
    void logRecommendationDecision(rec, surface, decision).catch(() => {});
    track("recommendation_decided", { decision, signal_count: rec.reasonCount });
    if (decision === "accepted") {
      startSolving({
        id: rec.problem.titleSlug,
        title: rec.problem.title,
        slug: rec.problem.titleSlug,
        difficulty: rec.problem.difficulty,
        category: rec.problem.patterns[0],
      });
    } else {
      setDismissed(true);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl border-hairline bg-surface p-5 ${className}`}>
        <div className="text-[11px] font-semibold text-text-secondary">Next battle</div>
        <p className="text-xs text-text-tertiary mt-1">Reading your history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border-hairline bg-surface p-5 ${className}`}>
        <div className="text-[11px] font-semibold text-text-secondary">Next battle</div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <p className="text-xs text-text-tertiary">{error}</p>
          <button
            onClick={() => void load()}
            className="px-3 py-1 rounded-full bg-surface-overlay text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // "Nothing to recommend" is a real answer. Saying it beats padding the card.
  if (!rec || dismissed) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="rounded-xl border-hairline bg-surface p-5">
        <div className="text-[11px] font-semibold text-text-secondary">Next battle</div>
        <p className="text-xs text-text-tertiary mt-1">
          {dismissed
            ? "Dismissed. Ask again when you want another suggestion."
            : "Nothing to recommend right now — no problem in your current sheet has a recorded reason to come back to."}
        </p>
        {!dismissed && (
          <Link
            href="/practice"
            className="inline-block mt-3 px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-[11px] font-bold"
          >
            Browse your sheet
          </Link>
        )}
        {dismissed && (
          <button
            onClick={() => {
              setDismissed(false);
              void load();
            }}
            className="mt-3 px-4 py-2 rounded-full bg-surface-overlay text-text-secondary hover:text-text-primary cursor-pointer"
          >
            Ask again
          </button>
        )}
        </div>

        {/* §24: once somebody has dismissed a suggestion there is something to
            read back. Before that the card would be an empty promise. */}
        {dismissed && (
          <div className="rounded-xl border-hairline bg-surface p-5 space-y-2">
            <div className="text-[11px] font-semibold text-text-secondary">
              Is this helping you?
            </div>
            <RecommendationStats />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-hairline bg-surface p-5 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-text-secondary">Next battle</span>
      </div>

      <div>
        <Link
          href={`/practice/${rec.problem.titleSlug}`}
          className="text-lg font-semibold text-text-primary hover:text-primary transition-colors"
        >
          {rec.problem.title}
        </Link>
        <p className="text-[11px] text-text-secondary">
          {rec.problem.difficulty}
          {rec.problem.patterns[0] ? ` · ${rec.problem.patterns[0]}` : ""}
        </p>
      </div>

      {/* Every bullet is a measurement. reasonCount is shown rather than hidden
          so a one-reason recommendation does not look like a strong one. */}
      <ul className="space-y-1">
        {rec.why.map((w) => (
          <li key={w} className="text-[11px] text-text-secondary flex gap-2">
            <span className="text-text-tertiary">·</span>
            <span>{w}</span>
          </li>
        ))}
      </ul>

      {rec.blockedBy.length > 0 && (
        <p className="text-[10px] text-primary/85">
          Listed despite unmet prerequisites ({rec.blockedBy.join(", ")}). You can skip it.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => void decide("accepted")}
          className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Play className="w-3 h-3 fill-current shrink-0" />
          {/* The label was a bare text node, so a narrow card broke it across
              two lines mid-phrase ("Start" / "this"). */}
          <span className="whitespace-nowrap">Start this</span>
        </button>
        <button
          onClick={() => void decide("dismissed")}
          className="px-3 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          title="Not this one"
        >
          <X className="w-3 h-3 shrink-0" />
          <span className="whitespace-nowrap">Not this</span>
        </button>
        <span className="text-[10px] text-text-secondary ml-auto shrink-0 whitespace-nowrap">
          {rec.reasonCount} {rec.reasonCount === 1 ? "reason" : "reasons"}
        </span>
      </div>
    </div>
  );
}
