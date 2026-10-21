"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import type { ProblemStatus } from "@/components/ui/ProblemRow";
import { TriState, ProblemEvent } from "@/types/database";

interface ProblemStatusCellProps {
  status: TriState;
  /** Return false when the write fails so the cell skips its celebration. */
  onToggle: (next: TriState) => void | Promise<boolean>;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** Enables the lazy timeline preview on hover (plan Step 8). */
  slug?: string;
  /**
   * True when problem_events holds a LeetCode-sourced solve/revisit for the
   * viewer. Solved + verified renders emerald; solved without it renders the
   * neutral self-reported outline — never emerald (DESIGN v4 honest data).
   */
  verified?: boolean;
}

export function ProblemStatusCell({
  status,
  onToggle,
  size = "md",
  showLabel = false,
  slug,
  verified = false,
}: ProblemStatusCellProps) {
  const [animating, setAnimating] = useState(false);
  const [preview, setPreview] = useState<{ events: ProblemEvent[] } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // History is fetched per-cell on first hover, never for the whole matrix: a
  // 350-row sheet must not fire 350 timeline queries (Bible §65).
  const loadPreview = async () => {
    if (!slug || preview) return;
    try {
      const { getOwnProblemTimeline } = await import("@/lib/data/problemEvents");
      setPreview({ events: await getOwnProblemTimeline(slug, 5) });
    } catch {
      setPreview({ events: [] });
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let next: TriState = "solved";
    if (status === "unsolved") {
      next = "solved";
    } else if (status === "solved") {
      next = "attempted";
    } else {
      next = "unsolved";
    }

    // Celebrate only persisted solves — a failed write rolls back upstream.
    const persisted = await onToggle(next);
    if (next === "solved" && persisted !== false) {
      setAnimating(true);
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 25,
          spread: 45,
          origin: {
            x: e.clientX / window.innerWidth,
            y: e.clientY / window.innerHeight,
          },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
      setTimeout(() => setAnimating(false), 600);
    }
  };

  const isSolved = status === "solved";
  const isAttempted = status === "attempted";
  // Emerald is proof only. A solved mark without a LeetCode-sourced event is
  // self-reported and renders neutral.
  const isVerified = isSolved && verified;
  const isSelfReported = isSolved && !verified;
  const hasHistory = (preview?.events.length ?? 0) > 0;
  const glyph: ProblemStatus = isVerified
    ? "verified"
    : isSelfReported
      ? "self-reported"
      : isAttempted
        ? "attempted"
        : "none";

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => {
        setPreviewOpen(true);
        void loadPreview();
      }}
      onMouseLeave={() => setPreviewOpen(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        title={
          isVerified
            ? "Status: Solved · Verified via LeetCode (Click to mark Attempted)"
            : isSelfReported
              ? "Status: Solved · Self-reported (Click to mark Attempted)"
              : isAttempted
                ? "Status: Attempting (Click to reset to Todo)"
                : "Status: Todo (Click to mark Solved)"
        }
        className={cn(
          "group relative flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-md transition-[background-color,transform] duration-150 hover:bg-surface-overlay",
          // The glyph stays 16px; the hit area grows to 44px on touch.
          size === "sm" && "h-11 min-w-11 px-1 md:h-8 md:min-w-8",
          size === "md" && "h-11 min-w-11 px-2 md:h-8",
          size === "lg" && "h-11 min-w-11 px-3",
          animating && "scale-110"
        )}
      >
        <StatusGlyph status={glyph} />
        {showLabel && (
          <span className="text-xs font-medium leading-4 text-text-secondary">
            {isSolved ? "Solved" : isAttempted ? "Attempting" : "Todo"}
          </span>
        )}
      </button>

      {/* ── Lazy timeline preview (plan Step 8: matrix cell becomes a preview) ── */}
      {slug && previewOpen && preview && (
        <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-64 rounded-md border border-hairline-strong bg-surface-overlay p-3 text-left shadow-overlay">
          {!hasHistory ? (
            <span className="block text-xs leading-4 text-text-secondary">
              No history yet. First solve starts the timeline.
            </span>
          ) : (
            <>
              <span className="mb-2 block font-mono text-[11px] font-medium tracking-[0.06em] text-text-tertiary">
                YOUR HISTORY
              </span>
              <span className="flex flex-col gap-1.5">
                {preview.events.map((e) => (
                  <span
                    key={e.id}
                    className="flex items-baseline justify-between gap-3 text-xs leading-4 text-text-secondary"
                  >
                    <span className="min-w-0 truncate">
                      {EVENT_LABEL[e.kind] ?? e.kind}
                      {(e.kind === "solved" || e.kind === "revisited") && (
                        <span
                          className={cn(
                            eventSource(e) === "leetcode" ? "text-verified" : "text-text-tertiary"
                          )}
                        >
                          {" "}· {eventSource(e) === "leetcode" ? "Verified" : "Self-reported"}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-text-tertiary tnum">
                      {e.duration_sec != null && <>{formatSeconds(e.duration_sec)} · </>}
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                  </span>
                ))}
              </span>
              <span className="mt-2 block border-t border-hairline pt-2 text-[11px] leading-4 text-pattern">
                Open problem for the full timeline →
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

const EVENT_LABEL: Record<string, string> = {
  attempted: "Attempted",
  solved: "Solved",
  explained: "Explained",
  revisited: "Revisited",
  challenge_completed: "Challenge completed",
  failed: "Failed",
  stuck: "Stuck",
};

function eventSource(e: ProblemEvent): string {
  const meta = (e.metadata ?? {}) as Record<string, unknown>;
  return typeof meta.source === "string" ? meta.source : "self";
}

function formatSeconds(total: number): string {
  const s = Math.trunc(total);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
