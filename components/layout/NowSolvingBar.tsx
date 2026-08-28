"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  X,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

interface ActiveProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
}

export function NowSolvingBar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(1455);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  const [activeProblem] = useState<ActiveProblem>({
    id: "15",
    title: "3Sum",
    slug: "3sum",
    difficulty: "Medium",
    category: "Two Pointers",
  });
  const [isCompleted, setIsCompleted] = useState(false);

  // Stopwatch interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const handleComplete = async () => {
    setIsCompleted(true);
    setIsPlaying(false);
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.9 },
      colors: ["#fa586a", "#30d158", "#ffd60a", "#0a84ff"],
    });
    setTimeout(() => setIsCompleted(false), 4000);
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
      default:
        return "text-white/40";
    }
  };

  return (
    <>
      {/* ── Scratchpad Popover ─────────────────────────── */}
      {isScratchpadOpen && (
        <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+8px)] right-6 w-96 max-w-[calc(100vw-3rem)] bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[150] p-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white pl-1">
              Intuition & Scratchpad
            </span>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="p-1 text-white/40 hover:text-white rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={scratchpadNote}
              onChange={(e) => setScratchpadNote(e.target.value)}
              placeholder="Write your 3-line approach / intuition before coding..."
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-none font-mono"
            />
            <div className="mt-2 flex justify-between items-center text-[10px] text-white/30 pl-1">
              <span>Saved locally to active solve session</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="px-3 py-1 bg-[#fa586a] text-white rounded-full font-medium text-xs hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Pill Bottom Bar (Apple Music LCD Chrome Player) ── */}
      <div className="floating-bottom-bar select-none">
        {/* Left: Timer Controls */}
        <div className="flex items-center gap-2 pl-2">
          <button
            onClick={() => setSeconds(0)}
            className="p-2 rounded-full text-white/35 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Reset Timer"
            aria-label="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-subtle transition-transform active:scale-95 cursor-pointer"
            aria-label={isPlaying ? "Pause Timer" : "Start Timer"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <div className="flex flex-col ml-1">
            <span className="font-mono text-[12px] font-bold text-white tracking-wider">
              {formatTime(seconds)}
            </span>
            <span className="text-[9px] text-white/35 uppercase tracking-wider font-semibold">
              {isPlaying ? "Solving" : "Paused"}
            </span>
          </div>
        </div>

        {/* Center: Problem Metadata (LCD Track Info) */}
        <div className="flex items-center justify-center gap-3 flex-1 max-w-xl mx-auto truncate px-4">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0 font-mono text-[11px] font-bold text-white/80">
            #{activeProblem.id}
          </div>

          <div className="flex flex-col truncate">
            <div className="flex items-center gap-2 truncate">
              <span className="text-[13px] font-semibold text-white truncate">
                {activeProblem.title}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                  getDifficultyBadge(activeProblem.difficulty)
                )}
              >
                {activeProblem.difficulty}
              </span>
              <span className="text-[11px] text-white/25 hidden lg:inline">
                • {activeProblem.category}
              </span>
            </div>
            <div className="text-[10px] text-white/35 truncate mt-0.5">
              Rahul & Arjun are also active
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 pr-2">
          {/* Scratchpad */}
          <button
            onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors hidden sm:flex items-center cursor-pointer",
              isScratchpadOpen
                ? "bg-white/[0.1] border-white/[0.14] text-white"
                : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            Notes
          </button>

          {/* LeetCode Link */}
          <a
            href={`https://leetcode.com/problems/${activeProblem.slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/40 hover:text-white transition-colors"
            title="Open on LeetCode"
            aria-label="Open on LeetCode"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Mark Solved */}
          <button
            onClick={handleComplete}
            disabled={isCompleted}
            className={cn(
              "px-3.5 py-1.5 rounded-full font-semibold text-xs transition-all cursor-pointer",
              isCompleted
                ? "bg-[#30d158] text-black"
                : "bg-[#fa586a] hover:bg-[#fa586a]/90 text-white shadow-glow"
            )}
          >
            {isCompleted ? "Solved" : "Mark Solved"}
          </button>
        </div>
      </div>
    </>
  );
}
