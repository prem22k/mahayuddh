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
  wrap?: boolean;
  /** Extra classes for the track (e.g. width, or `max-md:h-auto` so 44px options fit). */
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  wrap = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex h-9 items-center gap-1 rounded-md bg-well p-1",
        wrap && "h-auto flex-wrap rounded-xl",
        className
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
              "flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-sm px-3 font-medium transition-colors md:min-h-0",
              size === "sm" ? "py-1.5 text-[11px]" : "py-2 text-xs",
              active
                ? "bg-surface-overlay text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
