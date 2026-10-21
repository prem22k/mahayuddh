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
import { Button } from "@/components/ui/Button";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/** Same card language as the Arena "Up next" card. */
const CARD = "rounded-lg border border-hairline bg-surface p-4 md:p-6";

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} aria-hidden />
      <h2 className="text-sm font-semibold leading-5 text-text-primary">Next battle</h2>
    </div>
  );
}

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
      <section className={cn(CARD, className)} aria-label="Next battle" aria-busy>
        <Header />
        <p className="mt-2 text-xs leading-5 text-text-tertiary">Reading your history…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn(CARD, className)} aria-label="Next battle">
        <Header />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-text-secondary">{error}</p>
          <Button variant="secondary" className="shrink-0 border border-hairline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  // "Nothing to recommend" is a real answer. Saying it beats padding the card.
  if (!rec || dismissed) {
    return (
      <div className={cn("space-y-3", className)}>
        <section className={CARD} aria-label="Next battle">
          <Header />
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {dismissed
              ? "Dismissed. Ask again when you want another suggestion."
              : "Nothing to recommend right now — no problem in your current sheet has a recorded reason to come back to."}
          </p>
          {!dismissed && (
            <Link
              href="/practice"
              className="mt-4 inline-flex h-10 items-center rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]"
            >
              Browse your sheet
            </Link>
          )}
          {dismissed && (
            <Button
              variant="secondary"
              className="mt-4 border border-hairline"
              onClick={() => {
                setDismissed(false);
                void load();
              }}
            >
              Ask again
            </Button>
          )}
        </section>

        {/* §24: once somebody has dismissed a suggestion there is something to
            read back. Before that the card would be an empty promise. */}
        {dismissed && (
          <section className={cn(CARD, "space-y-3")} aria-label="Is this helping you?">
            <h3 className="text-sm font-medium leading-5 text-text-primary">Is this helping you?</h3>
            <RecommendationStats />
          </section>
        )}
      </div>
    );
  }

  return (
    <section className={cn(CARD, "flex flex-col gap-4", className)} aria-label="Next battle">
      <Header />

      <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <Link
          href={`/practice/${rec.problem.titleSlug}`}
          className="font-display text-lg font-semibold leading-tight text-text-primary transition-colors hover:text-primary md:font-sans md:text-base md:leading-6"
        >
          {rec.problem.title}
        </Link>
        <span className="flex flex-wrap items-center gap-2">
          <DifficultyBadgeNew difficulty={rec.problem.difficulty} size="sm" />
          {rec.problem.patterns[0] && (
            <PatternChip label={rec.problem.patterns[0]} className="h-5 px-2 text-[11px]" />
          )}
        </span>
      </div>

      {/* Every bullet is a measurement. reasonCount is shown rather than hidden
          so a one-reason recommendation does not look like a strong one. */}
      <ul className="flex flex-col gap-1.5">
        {rec.why.map((w) => (
          <li key={w} className="flex items-start gap-2 text-xs leading-5 text-text-secondary">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
            <span>{w}</span>
          </li>
        ))}
      </ul>

      {rec.blockedBy.length > 0 && (
        <p className="text-xs leading-5 text-primary">
          Listed despite unmet prerequisites ({rec.blockedBy.join(", ")}). You can skip it.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="secondary"
          className="h-11 shrink-0 border border-hairline md:h-10"
          onClick={() => void decide("accepted")}
        >
          <Play className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {/* The label was a bare text node, so a narrow card broke it across
              two lines mid-phrase ("Start" / "this"). */}
          <span className="whitespace-nowrap">Start this</span>
        </Button>
        <Button
          variant="ghost"
          className="h-11 shrink-0 md:h-10"
          onClick={() => void decide("dismissed")}
          title="Not this one"
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="whitespace-nowrap">Not this</span>
        </Button>
        <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
          {rec.reasonCount} {rec.reasonCount === 1 ? "reason" : "reasons"}
        </span>
      </div>
    </section>
  );
}
