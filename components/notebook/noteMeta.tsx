import React from "react";
import { Globe, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteVisibility } from "@/types/database";

/** Compact relative time for list metadata: "5m ago", "2d ago", "3mo ago". */
export function shortAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function visibilityLabel(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

const VISIBILITY_ICON: Record<NoteVisibility, typeof Lock> = {
  private: Lock,
  squad: Users,
  public: Globe,
};

/** Neutral visibility marker. Public is never emerald: emerald means verified proof. */
export function VisibilityTag({
  visibility,
  boxed = false,
  className,
}: {
  visibility: NoteVisibility;
  /** Outlined well chip (reader meta row) instead of bare icon + text. */
  boxed?: boolean;
  className?: string;
}) {
  const Icon = VISIBILITY_ICON[visibility] ?? Lock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs leading-4 text-text-tertiary",
        boxed && "h-6 rounded-xs border border-hairline bg-well px-2 font-mono",
        className
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={1.5} aria-hidden />
      {visibilityLabel(visibility)}
    </span>
  );
}
