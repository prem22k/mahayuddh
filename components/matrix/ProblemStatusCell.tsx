"use client";

import React, { useState } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TriState } from "@/types/database";
import confetti from "canvas-confetti";

interface ProblemStatusCellProps {
  status: TriState;
  onToggle: (next: TriState) => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ProblemStatusCell({
  status,
  onToggle,
  size = "md",
  showLabel = false,
}: ProblemStatusCellProps) {
  const [animating, setAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    let next: TriState = "solved";
    if (status === "unsolved") {
      next = "solved";
    } else if (status === "solved") {
      next = "attempted";
    } else {
      next = "unsolved";
    }

    if (next === "solved") {
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

    onToggle(next);
  };

  const isSolved = status === "solved";
  const isAttempted = status === "attempted";

  return (
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
        size === "md" && "px-2.5 py-1.2 text-xs",
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
  );
}
