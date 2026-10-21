"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export interface ProblemTab<T extends string> {
  value: T;
  label: string;
  /** Shorter label under 768px (e.g. "AI Practice"). */
  shortLabel?: string;
  /** Measured count, shown as a quiet mono bubble. Omitted when unknown. */
  count?: number;
  icon?: React.ReactNode;
}

/**
 * Problem page underline tabs (Stitch): gold underline on the active tab,
 * optional count bubbles, horizontally scrollable on phones. Arrow keys move
 * between tabs.
 */
export function ProblemTabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix = "problem-tab",
}: {
  tabs: readonly ProblemTab<T>[];
  value: T;
  onChange: (v: T) => void;
  idPrefix?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      className="-mx-4 flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-center gap-4 overflow-x-auto border-b border-hairline px-4 md:mx-0 md:gap-6 md:px-0"
    >
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-2 text-sm leading-5 transition-colors md:gap-2 md:pb-3",
              active
                ? "border-primary font-semibold text-text-primary"
                : "border-transparent font-medium text-text-secondary hover:text-text-primary"
            )}
          >
            {t.icon}
            {t.shortLabel ? (
              <>
                <span className="md:hidden">{t.shortLabel}</span>
                <span className="hidden md:inline">{t.label}</span>
              </>
            ) : (
              <span>{t.label}</span>
            )}
            {t.count != null && t.count > 0 && (
              <span
                className={cn(
                  "rounded-xs px-1.5 font-mono text-[11px] leading-4 tnum",
                  active ? "bg-well text-primary" : "bg-well text-text-tertiary"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
