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
  className,
}: {
  difficulty: string;
  className?: string;
}) {
  const level =
    difficulty.toLowerCase() === "easy" ? 1 : difficulty.toLowerCase() === "medium" ? 2 : 3;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm bg-transparent px-2 text-xs font-medium leading-4 text-text-secondary",
        className
      )}
    >
      {difficulty}
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1 rounded-full",
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
        "inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-tint px-2.5 text-sm font-medium leading-5 text-primary",
        className
      )}
    >
      <Flame
        className="h-4 w-4"
        strokeWidth={1.5}
        fill={alive ? "currentColor" : "none"}
      />
      {count}
    </span>
  );
}
