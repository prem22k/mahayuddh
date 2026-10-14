"use client";

import React from "react";
import Image from "next/image";
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

/** intrinsic px per size (h-6=24, h-8=32, h-12=48, h-20=80) for next/image. */
const sizePx = { sm: 24, md: 32, lg: 48, xl: 80 } as const;

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
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-overlay font-medium text-text-secondary",
        sizes[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${sizePx[size]}px`}
          className="rounded-full object-cover"
          // avatar_url is user-supplied and can point at any host: the
          // optimizer would 400 on hosts outside remotePatterns, so serve
          // the file as-is. Sizing/caching behavior is unchanged.
          unoptimized
        />
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
