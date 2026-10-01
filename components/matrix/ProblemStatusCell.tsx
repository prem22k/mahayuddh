"use client";

import React, { useState } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TriState, ProblemEvent } from "@/types/database";
import confetti from "canvas-confetti";

interface ProblemStatusCellProps {
  status: TriState;
  /** Return false when the write fails so the cell skips its celebration. */
  onToggle: (next: TriState) => void | Promise<boolean>;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** Enables the lazy timeline preview on hover (plan Step 8). */
  slug?: string;
}

export function ProblemStatusCell({
  status,
  onToggle,
  size = "md",
  showLabel = false,
  slug,
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
      confetti({
        particleCount: 25,
        spread: 45,
        origin: {
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight,
        },
        colors: ["#30d158", "#ffffff", "#ffd60a"],
      });
      setTimeout(() => setAnimating(false), 600);
    }
  };

  const isSolved = status === "solved";
  const isAttempted = status === "attempted";
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
        isSolved
          ? "Status: Solved (Click to mark Attempted)"
          : isAttempted
          ? "Status: Attempting (Click to reset to Todo)"
          : "Status: Todo (Click to mark Solved)"
      }
      className={cn(
        "group relative flex items-center justify-center rounded-xl transition-all select-none cursor-pointer",
        size === "sm" && "p-1.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-2 text-sm",
        isSolved &&
          "bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/35 hover:bg-[#30d158]/25 shadow-[0_0_12px_rgba(48,209,88,0.2)]",
        isAttempted &&
          "bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/35 hover:bg-[#ff9f0a]/25 shadow-[0_0_12px_rgba(255,159,10,0.2)]",
        !isSolved &&
          !isAttempted &&
          "bg-white/[0.03] text-white/35 border border-white/[0.08] hover:border-white/20 hover:text-white/80 hover:bg-white/[0.06]",
        animating && "scale-110"
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        {isSolved ? (
          <div className="w-3.5 h-3.5 rounded-full bg-[#30d158] text-black flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        ) : isAttempted ? (
          <div className="w-3.5 h-3.5 rounded-full bg-[#ff9f0a]/20 text-[#ff9f0a] flex items-center justify-center shrink-0">
            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        ) : (
          <div className="w-3.5 h-3.5 rounded-full border border-white/20 group-hover:border-white/50 flex items-center justify-center shrink-0">
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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-3 text-left pointer-events-none">
          {!hasHistory ? (
            <span className="block text-[11px] text-white/35">
              No history yet. First solve starts the timeline.
            </span>
          ) : (
            <>
              <span className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                Your history
              </span>
              <span className="flex flex-col gap-1">
                {preview.events.map((e) => (
                  <span key={e.id} className="block text-[10px] text-white/60 leading-tight">
                    <span className="text-white/35 font-mono">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>{" "}
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    {e.duration_sec != null && (
                      <span className="text-white/35 font-mono">
                        {" "}
                        · {formatSeconds(e.duration_sec)}
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <span className="block text-[10px] text-[#0a84ff] mt-1.5">
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

function formatSeconds(total: number): string {
  const s = Math.trunc(total);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
