"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Pass({
  body,
  stub,
  className,
  stubClassName,
}: {
  body: React.ReactNode;
  stub: React.ReactNode;
  className?: string;
  /** e.g. `justify-between` for a stub with a header block and a footer block. */
  stubClassName?: string;
}) {
  return (
    <div className={cn("pass", className)}>
      <div className="pass-body">{body}</div>
      <div className={cn("pass-stub", stubClassName)}>{stub}</div>
    </div>
  );
}

export function PassSerial({ children }: { children: React.ReactNode }) {
  return <div className="pass-serial">{children}</div>;
}

/** Stitch stub header: a quiet mono caption with an optional glyph on the right. */
export function PassStubHeader({
  label,
  icon,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary">
      <span>{label}</span>
      {icon && <span aria-hidden>{icon}</span>}
    </div>
  );
}

/** Stitch stub field: tiny uppercase label over a mono value (SERIAL / NO. 518). */
export function PassField({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col font-mono tracking-[0.06em]", className)}>
      <span className="text-[10px] font-medium uppercase leading-4 text-text-tertiary">{label}</span>
      <span className="truncate text-xs font-medium uppercase leading-4 text-text-primary tnum">
        {children}
      </span>
    </div>
  );
}

/** One dot per squad member: verified green when solved, hollow when not yet. */
export function PassDots({
  people,
  className,
}: {
  people: { name: string; done: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {people.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          title={`${p.name} · ${p.done ? "solved" : "not yet"}`}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            p.done ? "bg-verified" : "border border-hairline-strong bg-surface-overlay"
          )}
        />
      ))}
    </div>
  );
}
