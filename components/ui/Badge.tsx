"use client";

import React from "react";
import { Check, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm bg-verified-tint px-2 text-xs font-medium leading-4 text-verified",
        className
      )}
    >
      <Check className="h-3 w-3" strokeWidth={1.5} />
      Verified
    </span>
  );
}

export function SelfReportedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border border-hairline-strong bg-transparent px-2 text-xs font-medium leading-4 text-text-secondary",
        className
      )}
    >
      Self-reported
    </span>
  );
}

export function DifficultyBadgeNew({
  difficulty,
  size = "md",
  className,
}: {
  difficulty: string;
  /** `sm` is the compact dock/stub variant. */
  size?: "sm" | "md";
  className?: string;
}) {
  const level =
    difficulty.toLowerCase() === "easy" ? 1 : difficulty.toLowerCase() === "medium" ? 2 : 3;
  const sm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border border-hairline font-medium text-text-secondary",
        sm ? "h-5 gap-1 bg-well px-1.5 text-[11px] leading-4" : "h-6 gap-1.5 bg-transparent px-2 text-xs leading-4",
        className
      )}
    >
      {difficulty}
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "rounded-full",
              sm ? "h-1 w-1" : "h-1.5 w-1.5",
              i <= level ? "bg-text-secondary" : "bg-hairline-strong"
            )}
          />
        ))}
      </span>
    </span>
  );
}

export function PatternChip({
  label,
  href,
  className,
}: {
  label: string;
  href?: string;
  className?: string;
}) {
  const cls = cn(
    "inline-flex h-6 items-center rounded-full bg-pattern-tint px-2.5 text-xs font-medium leading-4 text-pattern",
    className
  );
  if (href) {
    return (
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a href={href} className={cls}>
        {label}
      </a>
    );
  }
  return <span className={cls}>{label}</span>;
}

export function StreakChip({
  count,
  alive,
  className,
}: {
  count: number;
  alive: boolean;
  className?: string;
}) {
  return (
    <span
      title={`${count}-day squad streak`}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary-tint px-2 font-mono text-xs font-medium leading-none text-primary tnum",
        className
      )}
    >
      <Flame
        className="h-3.5 w-3.5"
        strokeWidth={1.75}
        fill={alive ? "currentColor" : "none"}
      />
      {count}
    </span>
  );
}
