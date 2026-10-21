"use client";

import React, { useState } from "react";
import { Check, Contrast, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriState } from "@/types/database";

export type MatrixKind = "verified" | "solved" | "attempted" | "todo";

function kindOf(status: TriState, verified?: boolean): MatrixKind {
  if (status === "solved") return verified ? "verified" : "solved";
  if (status === "attempted") return "attempted";
  return "todo";
}

export function matrixStatusLabel(status: TriState, verified?: boolean): string {
  if (status === "solved") return verified ? "Verified via LeetCode" : "Self-reported solve";
  if (status === "attempted") return "Attempted";
  return "To do";
}

// One fill per state (DESIGN: matrix cell). Emerald is verified proof only;
// self-reported is a neutral outline, attempted a quiet overlay fill.
const CELL: Record<MatrixKind, string> = {
  verified: "border-verified/30 bg-verified-tint text-verified hover:border-verified",
  solved: "border-text-tertiary/40 bg-surface-raised text-text-secondary hover:border-text-secondary",
  attempted: "border-hairline bg-surface-overlay text-text-secondary hover:border-hairline-strong",
  todo: "border-hairline bg-well hover:border-hairline-strong",
};

function CellGlyph({ kind, small }: { kind: MatrixKind; small?: boolean }) {
  if (kind === "verified" || kind === "solved") {
    return (
      <Check
        className={small ? "h-2.5 w-2.5" : kind === "verified" ? "h-4 w-4" : "h-3.5 w-3.5"}
        strokeWidth={kind === "verified" ? 2 : 1.75}
      />
    );
  }
  if (kind === "attempted") {
    return <Contrast className={small ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} strokeWidth={1.75} />;
  }
  return null;
}

/** Legend swatch: the cell at 16px. */
export function MatrixLegendSwatch({ label, kind }: { label: string; kind: MatrixKind }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("flex h-4 w-4 items-center justify-center rounded-xs border", CELL[kind])}
        aria-hidden
      >
        <CellGlyph kind={kind} small />
      </span>
      {label}
    </span>
  );
}

/**
 * One problem in the category matrix. Clicking jumps to its row; hovering
 * shows the number, difficulty, state and (with the squad overlay on) how
 * many squad mates solved it. Names of solvers aren't fetched, so the
 * popover only ever shows counts.
 */
export function MatrixCell({
  title,
  number,
  difficulty,
  status,
  verified,
  squadCount,
  squadVerifiedCount,
  onOpen,
}: {
  title: string;
  number: string;
  difficulty: string;
  status: TriState;
  verified?: boolean;
  squadCount?: number;
  squadVerifiedCount?: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(status, verified);
  const label = matrixStatusLabel(status, verified);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`${title} · ${label}`}
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-sm border transition-colors md:h-8 md:w-8 md:rounded-xs",
          CELL[kind]
        )}
      >
        <CellGlyph kind={kind} />
        {kind === "todo" && (
          <span className="h-1 w-1 rounded-full bg-text-disabled/60 md:hidden" aria-hidden />
        )}
        {squadCount != null && squadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-hairline-strong bg-surface-overlay px-0.5 font-mono text-[9px] font-medium leading-none text-text-primary tnum">
            {squadCount}
          </span>
        )}
      </button>
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-md border border-hairline-strong bg-surface-overlay p-3 text-left shadow-overlay"
        >
          <span className="mb-1.5 flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-text-tertiary tnum">
              {number} · {difficulty}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-xs border px-1.5 py-0.5 font-mono text-[10px] leading-3",
                kind === "verified"
                  ? "border-verified/30 bg-verified-tint text-verified"
                  : "border-hairline-strong text-text-secondary"
              )}
            >
              {kind === "verified" && <span className="h-1 w-1 rounded-full bg-verified" />}
              {kind === "verified"
                ? "Verified"
                : kind === "solved"
                  ? "Self-reported"
                  : kind === "attempted"
                    ? "Attempted"
                    : "To do"}
            </span>
          </span>
          <span className="block text-[13px] font-semibold leading-tight text-text-primary">
            {title}
          </span>
          {squadCount != null && (
            <span className="mt-2 flex items-center gap-1.5 border-t border-hairline pt-2 text-[11px] leading-4 text-text-secondary">
              <Users className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
              {squadCount} squad solved
              {squadVerifiedCount != null && (
                <span className="text-text-tertiary"> · {squadVerifiedCount} verified</span>
              )}
            </span>
          )}
          <span
            className="absolute left-1/2 top-full -mt-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-hairline-strong bg-surface-overlay"
            aria-hidden
          />
        </span>
      )}
    </span>
  );
}
