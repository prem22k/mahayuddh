import React from "react";
import { cn } from "@/lib/utils";

/**
 * Solved share of a set: emerald for verified solves, neutral for
 * self-reported ones. Emerald never stands in for a self-reported mark.
 */
export function SplitBar({
  total,
  verified,
  selfReported,
  label,
  className,
}: {
  total: number;
  verified: number;
  selfReported: number;
  label: string;
  className?: string;
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const solvedPct = Math.round(pct(verified + selfReported));
  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full border border-hairline bg-well", className)}
      role="progressbar"
      aria-valuenow={solvedPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full bg-verified transition-all duration-200" style={{ width: `${pct(verified)}%` }} />
      <div
        className="h-full bg-text-secondary transition-all duration-200"
        style={{ width: `${pct(selfReported)}%` }}
      />
    </div>
  );
}
