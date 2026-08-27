"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  FileText,
  Users,
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
    // Dynamic import to avoid SSR issues
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.9 },
      colors: ["#fa586a", "#30d158", "#ffd60a", "#0a84ff"],
    });
    setTimeout(() => setIsCompleted(false), 4000);
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "easy":
        return "text-apple-green bg-apple-green/10 border-apple-green/30";
      case "medium":
        return "text-apple-orange bg-apple-orange/10 border-apple-orange/30";
      case "hard":
        return "text-apple-red bg-apple-red/10 border-apple-red/30";
      default:
        return "text-txt-secondary";
    }
  };

  return (
    <>
      {/* ── Scratchpad Popover ─────────────────────────── */}
      {isScratchpadOpen && (
        <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+8px)] right-6 w-96 max-w-[calc(100vw-3rem)] bg-surface-strong/95 backdrop-blur-2xl border border-border-strong rounded-2xl shadow-modal z-[150] p-4">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-apple-accent" />
              <span className="text-xs font-semibold text-white">
                Intuition & Scratchpad
              </span>
            </div>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="p-1 text-white/40 hover:text-white rounded-md"
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
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-apple-accent/40 resize-none font-mono"
            />
            <div className="mt-2 flex justify-between items-center text-[10px] text-white/30">
              <span>Saved locally to active solve session</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="px-2.5 py-1 bg-apple-accent text-white rounded-lg font-medium text-xs hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Pill Bottom Bar ───────────────────── */}
      <div className="floating-bottom-bar">
        {/* Left: Timer Controls */}
        <div className="flex items-center gap-2 pl-2">
          <button
            onClick={() => setSeconds(0)}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Reset Timer"
            aria-label="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-subtle transition-transform active:scale-95"
            aria-label={isPlaying ? "Pause Timer" : "Start Timer"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <div className="flex flex-col ml-1">
            <span className="font-mono text-[13px] font-bold text-white tracking-wider">
              {formatTime(seconds)}
            </span>
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">
              {isPlaying ? "Solving" : "Paused"}
            </span>
          </div>
        </div>

        {/* Center: Active Problem (like track metadata in chrome-player) */}
        <div className="flex items-center justify-center gap-3 flex-1 max-w-xl mx-auto truncate px-4">
          {/* Problem number badge */}
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.06] flex flex-col items-center justify-center shrink-0">
            <span className="text-[8px] font-mono text-white/30">#</span>
            <span className="text-[12px] font-bold text-white">
              {activeProblem.id}
            </span>
          </div>

          {/* Title & presence */}
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
            <div className="flex items-center gap-1.5 text-[11px] text-white/35 truncate mt-0.5">
              <Users className="w-3 h-3 text-apple-accent" />
              <span>Rahul & Arjun are also solving this</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 pr-2">
          {/* Scratchpad */}
          <button
            onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
            className={cn(
              "p-2 rounded-xl border text-xs font-medium transition-colors hidden sm:flex items-center gap-1.5",
              isScratchpadOpen
                ? "bg-white/[0.08] border-white/[0.12] text-white"
                : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
            )}
            title="Open Notes Scratchpad"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[11px]">Notes</span>
          </button>

          {/* LeetCode Link */}
          <a
            href={`https://leetcode.com/problems/${activeProblem.slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/40 hover:text-white transition-colors"
            title="Open on LeetCode"
            aria-label="Open on LeetCode"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Mark Solved */}
          <button
            onClick={handleComplete}
            disabled={isCompleted}
            className={cn(
              "px-3.5 py-2 rounded-full font-semibold text-xs transition-all flex items-center gap-1.5",
              isCompleted
                ? "bg-apple-green text-black"
                : "bg-apple-accent hover:opacity-90 text-white shadow-glow"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {isCompleted ? "Solved! 🎉" : "Mark Solved"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
