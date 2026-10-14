"use client";

import React, { useState } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
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

  return (
    <span
      className="relative inline-flex"
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
        "group relative flex items-center justify-center rounded-xl transition-all select-none cursor-pointer",
        size === "sm" && "p-1.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-2 text-sm",
        isVerified &&
          "bg-verified/15 text-verified border border-verified/35 hover:bg-verified/25 shadow-[0_0_12px_rgba(61,220,151,0.2)]",
        isSelfReported &&
          "bg-surface text-text-secondary border border-hairline-strong hover:bg-surface-overlay hover:text-text-primary",
        isAttempted &&
          "bg-primary/15 text-primary border border-primary/35 hover:bg-primary/25 shadow-[0_0_12px_rgba(245,184,61,0.2)]",
        !isSolved &&
          !isAttempted &&
          "bg-surface text-text-tertiary border border-hairline hover:border-hairline-strong hover:text-text-secondary hover:bg-surface-overlay",
        animating && "scale-110"
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        {isVerified ? (
          <div className="w-3.5 h-3.5 rounded-full bg-verified text-on-primary flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        ) : isSelfReported ? (
          <div className="w-3.5 h-3.5 rounded-full border border-hairline-strong text-text-secondary flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        ) : isAttempted ? (
          <div className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        ) : (
          <div className="w-3.5 h-3.5 rounded-full border border-hairline group-hover:border-hairline-strong flex items-center justify-center shrink-0">
            <Circle className="w-2 h-2 text-transparent" />
          </div>
        )}

        {showLabel && (
          <span className="text-[11px] tracking-tight">
            {isSolved ? "Solved" : isAttempted ? "Attempting" : "Todo"}
          </span>
        )}
      </div>
    </button>

      {/* ── Lazy timeline preview (plan Step 8: matrix cell becomes a preview) ── */}
      {slug && previewOpen && preview && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 popover-panel p-3 text-left pointer-events-none">
          {!hasHistory ? (
            <span className="block text-[11px] text-text-secondary">
              No history yet. First solve starts the timeline.
            </span>
          ) : (
            <>
              <span className="block text-[11px] font-semibold text-text-secondary mb-1.5">
                Your history
              </span>
              <span className="flex flex-col gap-1">
                {preview.events.map((e) => (
                  <span key={e.id} className="block text-[10px] text-text-secondary leading-tight">
                    <span className="text-text-tertiary font-mono">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>{" "}
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    {(e.kind === "solved" || e.kind === "revisited") && (
                      <span className="text-text-tertiary">
                        {" "}· {eventSource(e) === "leetcode" ? "Verified" : "Self-reported"}
                      </span>
                    )}
                    {e.duration_sec != null && (
                      <span className="text-text-tertiary font-mono">
                        {" "}
                        · {formatSeconds(e.duration_sec)}
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <span className="block text-[10px] text-pattern mt-1.5">
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
