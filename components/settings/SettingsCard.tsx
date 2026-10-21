"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Settings building blocks (Stitch "Profile & Settings"): one card per
 * section, label/caption rows split by hairlines, and a neutral switch.
 *
 * The switch is white-on, not the frame's emerald: emerald is reserved for
 * verified proof, and gold for the one primary action and the streak.
 */

/** Small outlined action (Edit, Open, Import, Disconnect). 44px tall on phones. */
export const outlineAction =
  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-transparent px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled md:h-8";

export function SettingsCard({
  id,
  title,
  description,
  badge,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  /** Sits right after the title (e.g. "Connected"). */
  badge?: React.ReactNode;
  /** Sits at the right end of the header row (e.g. "Join with code"). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `${id}-h`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-24 rounded-xl border border-hairline bg-surface p-4 md:p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={headingId}
              className="text-sm font-semibold leading-5 tracking-[-0.01em] text-text-primary md:text-[17px] md:leading-6"
            >
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-3 md:mt-4">{children}</div>
    </section>
  );
}

/** A label + caption on the left, a control on the right. */
export function SettingsRow({
  label,
  caption,
  children,
  labelId,
  className,
}: {
  label: React.ReactNode;
  caption?: React.ReactNode;
  children?: React.ReactNode;
  labelId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3.5",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-xs font-medium leading-5 text-text-primary md:text-sm">
          {label}
        </span>
        {caption && <span className="text-[11px] leading-4 text-text-tertiary md:text-xs">{caption}</span>}
      </div>
      {children}
    </div>
  );
}

/** Field rows (Account): a small caption label above the value. */
export function SettingsField({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-medium leading-4 text-text-tertiary md:text-xs">{label}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text-primary">
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SettingsSwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-end"
    >
      <span
        className={cn(
          "inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors md:w-10",
          on ? "bg-text-primary" : "border border-hairline-strong bg-surface-overlay"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full shadow-sm transition-transform",
            on ? "translate-x-4 bg-canvas md:translate-x-5" : "h-3.5 w-3.5 bg-text-secondary"
          )}
        />
      </span>
    </button>
  );
}
