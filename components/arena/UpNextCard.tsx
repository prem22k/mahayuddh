"use client";

import React from "react";
import Link from "next/link";
import { RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/**
 * Arena "Up next" card (Stitch): title · No. · difficulty · pattern on one
 * line, then the revenge line (or the starter hint), then the actions.
 */
export function UpNextCard({
  slug,
  title,
  no,
  difficulty,
  pattern,
  revenge,
  hint,
  canSkip,
  onStart,
  onSkip,
  className,
}: {
  slug: string;
  title: string;
  no: string;
  difficulty: string;
  pattern: string;
  /** The caller's last failed attempt on this problem, when one exists. */
  revenge: { time: string | null; when: string | null } | null;
  /** Shown when there is no revenge to take. */
  hint: string;
  canSkip: boolean;
  onStart: () => void;
  onSkip: () => void;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5 md:gap-3", className)} aria-label="Up next">
      <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-text-primary md:text-lg md:leading-[26px]">
        Up next
      </h2>
      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong md:gap-4 md:p-6">
        <div className="flex flex-col gap-1 md:gap-2">
          <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-2">
            <Link
              href={`/practice/${slug}`}
              className="order-2 font-display text-lg font-semibold leading-tight text-text-primary transition-colors hover:text-primary md:order-1 md:font-sans md:text-base md:leading-6"
            >
              {title}
            </Link>
            <span className="order-1 flex flex-wrap items-center gap-2 md:order-2">
              <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                {no}
              </span>
              <DifficultyBadgeNew difficulty={difficulty} size="sm" />
              <PatternChip label={pattern} className="h-5 px-2 text-[11px]" />
            </span>
          </div>

          {revenge ? (
            <p className="flex items-start gap-1.5 text-xs leading-5 text-text-secondary max-md:mt-1 max-md:rounded-md max-md:border max-md:border-hairline max-md:bg-well/70 max-md:p-2.5">
              <RotateCcw className="mt-[3px] h-3.5 w-3.5 shrink-0 text-error" strokeWidth={1.75} aria-hidden />
              <span>
                <span className="font-medium text-error">Revenge available</span>
                {revenge.time ? (
                  <>
                    {" · you stopped at "}
                    <span className="font-mono text-text-primary tnum">{revenge.time}</span>
                    {revenge.when ? ` ${revenge.when}` : ""}
                  </>
                ) : revenge.when ? (
                  ` · last attempt ${revenge.when}`
                ) : null}
              </span>
            </p>
          ) : (
            <p className="text-xs leading-5 text-text-secondary">{hint}</p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="secondary" className="h-11 border border-hairline md:h-10" onClick={onStart}>
            {revenge ? (
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Swords className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            {revenge ? "Take revenge" : "Start battle"}
          </Button>
          {canSkip && (
            <Button variant="ghost" className="h-11 md:h-10" onClick={onSkip}>
              Not this
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
