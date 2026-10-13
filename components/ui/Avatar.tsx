"use client";

import React from "react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-lg",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-overlay font-medium text-text-secondary",
        sizes[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  className,
}: {
  people: { name: string; src?: string | null }[];
  className?: string;
}) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <span className={cn("inline-flex items-center", className)}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size="sm"
          className={cn(i > 0 && "-ml-2 ring-2 ring-canvas")}
        />
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay text-[10px] font-medium text-text-secondary ring-2 ring-canvas">
          +{extra}
        </span>
      )}
    </span>
  );
}
