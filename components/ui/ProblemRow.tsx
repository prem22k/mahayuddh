"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadgeNew, PatternChip, VerifiedBadge, SelfReportedBadge } from "./Badge";

export type ProblemStatus = "verified" | "self-reported" | "attempted" | "active" | "none";

/** Stitch status glyphs: live gold dot, verified tick, half-filled attempt, empty ring. */
export function StatusGlyph({ status }: { status: ProblemStatus }) {
  if (status === "active") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-label="Battle running">
        <span className="h-2.5 w-2.5 animate-gold-pulse rounded-full bg-primary" />
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-verified-tint text-verified" aria-label="Verified solve">
        <Check className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  if (status === "self-reported") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-text-secondary" aria-label="Self-reported solve">
        <Check className="h-2.5 w-2.5" strokeWidth={2} />
      </span>
    );
  }
  if (status === "attempted") {
    return (
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline-strong" aria-label="Attempted">
        <span className="absolute inset-y-0 left-0 w-1/2 bg-text-tertiary" />
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-label="Not started">
      <span className="h-3.5 w-3.5 rounded-full border border-hairline-strong" />
    </span>
  );
}

/**
 * Stitch problem row: one 56px line. Status · No. · title · difficulty ·
 * pattern on the left; the social hint / best time and an action on the right.
 * `action` replaces the default quiet "Start" label when a row needs a real
 * button-looking affordance (Revisit, Take revenge, Active battle).
 */
export function ProblemRow({
  href,
  title,
  number,
  difficulty,
  pattern,
  status,
  socialHint,
  bestTime,
  action,
  className,
}: {
  href: string;
  title: string;
  number: string;
  difficulty: string;
  pattern?: string;
  status: ProblemStatus;
  socialHint?: React.ReactNode;
  bestTime?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  // Stretched link: the title's link covers the row, so the whole row is one
  // click target, while `action` (often a real <button>) sits above it rather
  // than nested inside an <a>, which is invalid HTML.
  return (
    <div
      className={cn(
        "group relative flex min-h-14 items-center gap-4 rounded-lg border border-hairline px-4 py-2 transition-colors hover:border-hairline-strong hover:bg-surface-raised",
        status === "active" ? "bg-surface-raised" : "bg-surface",
        className
      )}
    >
      <StatusGlyph status={status} />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
        <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">{number}</span>
        <Link
          href={href}
          className="min-w-0 truncate text-[15px] font-medium leading-6 text-text-primary after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-text-primary/70"
        >
          {title}
        </Link>
        <DifficultyBadgeNew difficulty={difficulty} />
        {pattern && <PatternChip label={pattern} className="shrink-0" />}
        {status === "verified" && <VerifiedBadge className="shrink-0 md:hidden" />}
        {status === "self-reported" && <SelfReportedBadge className="shrink-0" />}
      </span>
      <span className="relative z-10 flex shrink-0 items-center gap-4">
        {socialHint && (
          <span className="hidden text-[13px] leading-5 text-text-secondary lg:block">{socialHint}</span>
        )}
        {bestTime && (
          <span
            className={cn(
              "font-mono text-sm font-medium tnum",
              status === "verified" ? "text-verified" : "text-text-primary"
            )}
          >
            {bestTime}
          </span>
        )}
        {action ?? (
          <span
            aria-hidden
            className="pointer-events-none hidden h-8 items-center rounded-md border border-hairline px-3 text-xs font-medium text-text-secondary transition-colors group-hover:border-hairline-strong group-hover:text-text-primary md:flex"
          >
            Start
          </span>
        )}
      </span>
    </div>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
  leading,
  scroll = false,
  label = "Filters",
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  /** Optional glyph rendered before an option's text (a status dot, an icon). */
  leading?: Partial<Record<string, React.ReactNode>>;
  /** One scrolling line below md instead of wrapping. */
  scroll?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        scroll && "max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]"
      )}
      role="group"
      aria-label={label}
    >
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o)}
            className={cn(
              "flex h-8 min-h-[44px] items-center rounded-full px-3 text-sm font-medium leading-5 transition-colors md:min-h-0",
              leading?.[o] != null && "gap-1.5",
              scroll && "shrink-0 whitespace-nowrap",
              active
                ? "bg-surface-overlay text-text-primary"
                : "bg-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {leading?.[o]}
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabs({
  tabs,
  value,
  onChange,
  counts,
}: {
  tabs: readonly string[];
  value: string;
  onChange: (v: string) => void;
  /** Optional count shown after a tab's label in quiet mono ("Sent 2"). */
  counts?: Partial<Record<string, number>>;
}) {
  return (
    <div className="flex gap-6 border-b border-hairline" role="tablist">
      {tabs.map((t) => {
        const active = value === t;
        const count = counts?.[t];
        return (
          <button
            key={t}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={cn(
              "h-10 min-h-[44px] text-sm font-medium leading-5 transition-colors md:min-h-0",
              count != null && "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap",
              active
                ? "border-b-2 border-text-primary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t}
            {count != null && " "}
            {count != null && (
              <span className="font-mono text-xs font-medium text-text-tertiary tnum">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
