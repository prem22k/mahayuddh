"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Five segments don't fit one pill row on a 390px screen. */
  wrap?: boolean;
}

/**
 * Segmented switcher (Sign In / Join Squad, Squad / Global, leaderboard
 * segments). One component because all three were hand-rolled with the same
 * shape and the same two defects: no announced state, and 28-32px tall.
 * State is `aria-pressed` on a `role="group"`, never a silent visual.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  wrap = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.06]",
        wrap ? "flex-wrap rounded-3xl" : "rounded-full"
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 min-h-11 px-3.5 rounded-full font-semibold transition-colors cursor-pointer flex items-center justify-center",
              size === "sm" ? "py-1.5 text-[11px]" : "py-2 text-xs",
              active ? "bg-white/[0.12] text-white shadow-sm" : "text-white/55 hover:text-white/80"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
