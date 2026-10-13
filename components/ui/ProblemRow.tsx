"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadgeNew, PatternChip, VerifiedBadge, SelfReportedBadge } from "./Badge";

export type ProblemStatus = "verified" | "self-reported" | "attempted" | "none";

export function StatusGlyph({ status }: { status: ProblemStatus }) {
  if (status === "verified") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verified-tint text-verified">
        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === "self-reported") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline-strong text-text-secondary">
        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === "attempted") {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-hairline-strong">
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <span className="block h-full w-1/2 bg-surface-overlay" />
        </span>
      </span>
    );
  }
  return <span className="block h-6 w-6 rounded-full border border-hairline-strong" />;
}

export function ProblemRow({
  href,
  title,
  number,
  difficulty,
  pattern,
  status,
  socialHint,
  bestTime,
}: {
  href: string;
  title: string;
  number: string;
  difficulty: string;
  pattern?: string;
  status: ProblemStatus;
  socialHint?: string;
  bestTime?: string;
}) {
  return (
    <Link
      href={href}
      className="card-interactive group flex h-14 items-center gap-3 rounded-xl border border-hairline bg-surface px-4"
    >
      <StatusGlyph status={status} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-text-primary">
          {title}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-xs text-text-tertiary tnum">{number}</span>
          <DifficultyBadgeNew difficulty={difficulty} />
          {pattern && <PatternChip label={pattern} />}
          {status === "verified" && <VerifiedBadge />}
          {status === "self-reported" && <SelfReportedBadge />}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {socialHint && (
          <span className="hidden text-xs text-text-tertiary sm:block">{socialHint}</span>
        )}
        {bestTime && (
          <span className="font-mono text-sm text-text-primary tnum">{bestTime}</span>
        )}
        <span className="hidden text-sm font-medium text-text-secondary group-hover:text-text-primary md:block">
          Start
        </span>
      </span>
    </Link>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
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
              active
                ? "bg-surface-overlay text-text-primary"
                : "bg-transparent text-text-secondary hover:text-text-primary"
            )}
          >
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
}: {
  tabs: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-6 border-b border-hairline" role="tablist">
      {tabs.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={cn(
              "h-10 min-h-[44px] text-sm font-medium leading-5 transition-colors md:min-h-0",
              active
                ? "border-b-2 border-text-primary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
